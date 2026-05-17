import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const connection = await prisma.oAuthConnection.findFirst({
    where: { userId, provider: "google", connectionStatus: "active" },
  });

  if (!connection) {
    return NextResponse.json({ error: "Not connected to Google" }, { status: 404 });
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
      return NextResponse.json({ error: "Token expired, please reconnect" }, { status: 401 });
    }
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    // Fetch GA4 properties from Analytics Admin API
    const ga4Res = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/~all&pageSize=100",
      { headers }
    );
    const ga4Data = await ga4Res.json();

    // Fetch Search Console sites
    const gscRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers });
    const gscData = await gscRes.json();

    return NextResponse.json({
      ga4Properties: (ga4Data.properties ?? []).map((p: any) => ({
        id: p.name,          // e.g. "properties/123456789"
        name: p.displayName,
        websiteUrl: p.websiteUri ?? null,
      })),
      gscSites: (gscData.siteEntry ?? []).map((s: any) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      })),
    });
  } catch (err) {
    console.error("Google accounts fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}
