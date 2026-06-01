import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getProviderAccessToken } from "@/lib/integrations/tokens";
import { reportLogger } from "@/lib/report/logger";

const prisma = new PrismaClient();

interface PropertySummary {
  property?: string;
  displayName?: string;
}

interface AccountSummary {
  propertySummaries?: PropertySummary[];
}

function normalizeCustomerId(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id as string;
    const accessToken = await getProviderAccessToken(prisma, userId, "google");
    const headers = { Authorization: `Bearer ${accessToken}` };
    const warnings: string[] = [];
    const properties = new Map<string, { id: string; name: string; websiteUrl: null }>();
    const googleAdsAccounts: Array<{ id: string; name: string }> = [];
    let pageToken = "";

    do {
      const params = new URLSearchParams({ pageSize: "200" });
      if (pageToken) params.set("pageToken", pageToken);

      const ga4Res = await fetch(
        `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${params.toString()}`,
        { headers }
      );
      const ga4Data = await ga4Res.json();

      if (!ga4Res.ok) {
        reportLogger.warn("Google Analytics Admin accounts fetch failed");
        warnings.push("Не можахме да заредим GA4 пропъртитата. Проверете дали Google Analytics Admin API е активиран и дали акаунтът има достъп.");
        break;
      }

      for (const account of (ga4Data.accountSummaries ?? []) as AccountSummary[]) {
        for (const property of account.propertySummaries ?? []) {
          if (property.property) {
            properties.set(property.property, {
              id: property.property,
              name: property.displayName ?? property.property,
              websiteUrl: null,
            });
          }
        }
      }

      pageToken = ga4Data.nextPageToken ?? "";
    } while (pageToken);

    const gscRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers });
    const gscData = await gscRes.json();
    if (!gscRes.ok) {
      reportLogger.warn("Google Search Console sites fetch failed");
      warnings.push("Не можахме да заредим Search Console сайтовете. Проверете дали Search Console API е активиран и дали акаунтът има достъп.");
    }

    const googleAdsDeveloperToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (googleAdsDeveloperToken) {
      const googleAdsApiVersion = process.env.GOOGLE_ADS_API_VERSION || "v22";
      const googleAdsHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": googleAdsDeveloperToken,
      };
      if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
        googleAdsHeaders["login-customer-id"] = normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
      }

      const adsRes = await fetch(`https://googleads.googleapis.com/${googleAdsApiVersion}/customers:listAccessibleCustomers`, {
        headers: googleAdsHeaders,
      });
      const adsData = await adsRes.json();
      if (!adsRes.ok) {
        reportLogger.warn("Google Ads customers fetch failed");
        warnings.push("Не можахме да заредим Google Ads акаунтите. Проверете Developer Token, adwords OAuth scope и достъпа до Ads акаунта.");
      } else {
        for (const resourceName of adsData.resourceNames ?? []) {
          const id = String(resourceName).replace("customers/", "");
          if (id) {
            googleAdsAccounts.push({ id, name: `Customer ${id}` });
          }
        }
      }
    } else {
      warnings.push("Google Ads акаунтите не са заредени, защото липсва GOOGLE_ADS_DEVELOPER_TOKEN.");
    }

    return NextResponse.json({
      ga4Properties: Array.from(properties.values()),
      gscSites: (gscRes.ok ? (gscData.siteEntry ?? []) : []).map((site: any) => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
      })),
      googleAdsAccounts,
      warnings,
    });
  } catch (error: any) {
    reportLogger.warn("Google accounts fetch failed");
    const status = error.message?.includes("връзката") || error.message?.includes("интеграция") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Google акаунтите не могат да бъдат заредени в момента." }, { status });
  }
}
