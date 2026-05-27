import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

interface PropertySummary {
  property?: string;
  displayName?: string;
}

interface AccountSummary {
  propertySummaries?: PropertySummary[];
}

async function refreshGoogleToken(connection: { id: string; refreshToken: string | null }) {
  if (!connection.refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) return null;

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await prisma.oAuthConnection.update({
    where: { id: connection.id },
    data: { accessToken: data.access_token, tokenExpiresAt: expiresAt },
  });

  return data.access_token as string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const connection = await prisma.oAuthConnection.findFirst({
    where: { userId, provider: "google", connectionStatus: "active" },
  });

  if (!connection) {
    return NextResponse.json({ error: "Няма свързан Google акаунт." }, { status: 404 });
  }

  // Auto-refresh token if expired
  let accessToken = connection.accessToken;
  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
    const refreshed = await refreshGoogleToken(connection);
    if (refreshed) {
      accessToken = refreshed;
    } else {
      // Mark as expired in DB
      await prisma.oAuthConnection.update({
        where: { id: connection.id },
        data: { connectionStatus: "expired" },
      });
      return NextResponse.json({ error: "Google връзката е изтекла. Свържете акаунта отново." }, { status: 401 });
    }
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    const warnings: string[] = [];
    const properties = new Map<string, { id: string; name: string; websiteUrl: null }>();
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
        console.error("Google Analytics Admin API error:", ga4Data);
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
      console.error("Google Search Console API error:", gscData);
      warnings.push("Не можахме да заредим Search Console сайтовете. Проверете дали Search Console API е активиран и дали акаунтът има достъп.");
    }

    return NextResponse.json({
      ga4Properties: Array.from(properties.values()),
      gscSites: (gscRes.ok ? (gscData.siteEntry ?? []) : []).map((s: any) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      })),
      warnings,
    });
  } catch (err) {
    console.error("Google accounts fetch error:", err);
    return NextResponse.json({ error: "Google акаунтите не могат да бъдат заредени в момента." }, { status: 500 });
  }
}
