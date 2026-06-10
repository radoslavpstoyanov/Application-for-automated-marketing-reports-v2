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

function cleanEnvValue(value: string | undefined) {
  return value?.trim();
}

function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages.map((message) => message.trim()).filter(Boolean)));
}

function textSnippet(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 800);
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  try {
    return { data: text ? JSON.parse(text) : null, text };
  } catch {
    return { data: null, text };
  }
}

function googleAdsErrorMessage(data: any, rawText = "") {
  const messages: string[] = [];
  const error = data?.error;

  if (typeof error?.message === "string" && error.message.trim()) {
    messages.push(error.message);
  }

  for (const detail of error?.details ?? []) {
    for (const adsError of detail?.errors ?? []) {
      if (typeof adsError?.message === "string" && adsError.message.trim()) {
        messages.push(adsError.message);
      }

      const errorCode = adsError?.errorCode;
      if (errorCode && typeof errorCode === "object") {
        const code = Object.entries(errorCode)
          .map(([group, value]) => `${group}: ${value}`)
          .join(", ");
        if (code) messages.push(code);
      }
    }

    if (typeof detail?.requestId === "string" && detail.requestId.trim()) {
      messages.push(`Google request ID: ${detail.requestId}`);
    }
  }

  if (typeof error?.status === "string" && error.status.trim()) {
    messages.push(`Status: ${error.status}`);
  }

  const rawSnippet = textSnippet(rawText);
  if (!messages.length && rawSnippet) {
    messages.push(`Raw response: ${rawSnippet}`);
  }

  return uniqueMessages(messages).join(" ");
}

function googleAdsHttpError(response: Response, data: any, rawText: string) {
  const parsed = googleAdsErrorMessage(data, rawText);
  return `[HTTP ${response.status} ${response.statusText}] ${parsed || "Google Ads API върна грешка без JSON body."}`;
}

async function fetchGoogleAdsCustomerClients(
  apiVersion: string,
  accessToken: string,
  developerToken: string,
  managerCustomerId: string
) {
  const response = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${managerCustomerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "developer-token": developerToken,
      "login-customer-id": managerCustomerId,
    },
    body: JSON.stringify({
      query: `
        SELECT
          customer_client.client_customer,
          customer_client.descriptive_name,
          customer_client.manager,
          customer_client.status
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
      `,
    }),
  });
  const { data, text } = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(googleAdsHttpError(response, data, text));
  }

  const chunks = Array.isArray(data) ? data : [data];
  return chunks.flatMap((chunk) => chunk.results ?? []) as Array<{
    customerClient?: {
      clientCustomer?: string;
      descriptiveName?: string;
      manager?: boolean;
    };
  }>;
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
    const googleAdsDiagnostics: string[] = [];
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

    const googleAdsDeveloperToken = cleanEnvValue(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
    if (googleAdsDeveloperToken) {
      const googleAdsApiVersion = cleanEnvValue(process.env.GOOGLE_ADS_API_VERSION) || "v22";
      const googleAdsLoginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
        ? normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
        : "";
      googleAdsDiagnostics.push(`Google Ads API version: ${googleAdsApiVersion}`);
      googleAdsDiagnostics.push(`Developer token configured: yes`);
      googleAdsDiagnostics.push(`Login customer ID: ${googleAdsLoginCustomerId || "not configured"}`);
      const googleAdsHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": googleAdsDeveloperToken,
      };

      if (googleAdsLoginCustomerId) {
        try {
          const clients = await fetchGoogleAdsCustomerClients(
            googleAdsApiVersion,
            accessToken,
            googleAdsDeveloperToken,
            googleAdsLoginCustomerId
          );
          for (const row of clients) {
            const client = row.customerClient;
            const id = String(client?.clientCustomer ?? "").replace("customers/", "");
            if (id && id !== googleAdsLoginCustomerId && !client?.manager) {
              googleAdsAccounts.push({ id, name: client?.descriptiveName || `Customer ${id}` });
            }
          }
          googleAdsDiagnostics.push(`MCC customer_client query succeeded. Client accounts found: ${googleAdsAccounts.length}`);
        } catch (error: any) {
          reportLogger.warn("Google Ads customer clients fetch failed");
          const message = error.message || "Неизвестна грешка.";
          googleAdsDiagnostics.push(`MCC customer_client query failed: ${message}`);
          warnings.push(`Не можахме да заредим Google Ads клиентските акаунти. ${message}`);
        }
      }

      if (googleAdsAccounts.length === 0) {
        const adsRes = await fetch(`https://googleads.googleapis.com/${googleAdsApiVersion}/customers:listAccessibleCustomers`, {
          headers: googleAdsHeaders,
        });
        const { data: adsData, text: adsText } = await readResponseBody(adsRes);
        if (!adsRes.ok) {
          const details = googleAdsHttpError(adsRes, adsData, adsText);
          reportLogger.warn("Google Ads customers fetch failed");
          googleAdsDiagnostics.push(`listAccessibleCustomers failed: ${details}`);
          warnings.push(
            `Не можахме да заредим Google Ads акаунтите. ${
              details || "Проверете Developer Token, adwords OAuth scope и достъпа до Ads акаунта."
            }`
          );
        } else {
          for (const resourceName of adsData.resourceNames ?? []) {
            const id = String(resourceName).replace("customers/", "");
            if (id) {
              googleAdsAccounts.push({ id, name: `Customer ${id}` });
            }
          }
          googleAdsDiagnostics.push(`listAccessibleCustomers succeeded. Accounts found: ${googleAdsAccounts.length}`);
        }
      }

      if (googleAdsLoginCustomerId && googleAdsAccounts.length === 0) {
        warnings.push("Google Ads Manager акаунтът е достъпен, но не върна активни клиентски акаунти.");
      } else {
        googleAdsAccounts.sort((a, b) => a.name.localeCompare(b.name));
      }
    } else {
      warnings.push("Google Ads акаунтите не са заредени, защото липсва GOOGLE_ADS_DEVELOPER_TOKEN.");
      googleAdsDiagnostics.push("Developer token configured: no");
    }

    return NextResponse.json({
      ga4Properties: Array.from(properties.values()),
      gscSites: (gscRes.ok ? (gscData.siteEntry ?? []) : []).map((site: any) => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
      })),
      googleAdsAccounts,
      warnings,
      googleAdsDiagnostics,
    });
  } catch (error: any) {
    reportLogger.warn("Google accounts fetch failed");
    const status = error.message?.includes("връзката") || error.message?.includes("интеграция") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Google акаунтите не могат да бъдат заредени в момента." }, { status });
  }
}
