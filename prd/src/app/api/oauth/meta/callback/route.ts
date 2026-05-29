import { PrismaClient } from "@prisma/client";
import { NextResponse, NextRequest } from "next/server";
import { encryptSecret } from "@/lib/integrations/tokens";
import { parseOAuthState } from "@/lib/integrations/oauth-state";
import { reportLogger } from "@/lib/report/logger";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = process.env.NEXTAUTH_URL!;

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/integrations?error=meta_denied", base));
  }

  try {
    const userId = parseOAuthState(state);

    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          redirect_uri: `${base}/api/oauth/meta/callback`,
          code,
        })
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      reportLogger.warn("Meta token exchange failed");
      return NextResponse.redirect(new URL("/integrations?error=meta_token", base));
    }

    // Step 2: Exchange short-lived token for long-lived token (~60 days)
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          fb_exchange_token: tokenData.access_token,
        })
    );
    const longLivedData = await longLivedRes.json();

    const finalToken = longLivedData.access_token || tokenData.access_token;
    // Long-lived tokens expire in ~60 days; fallback to 60 days if not provided
    const expiresIn = longLivedData.expires_in ?? 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Upsert OAuthConnection
    const existing = await prisma.oAuthConnection.findFirst({
      where: { userId, provider: "meta" },
    });

    if (existing) {
      await prisma.oAuthConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: encryptSecret(finalToken)!,
          tokenExpiresAt: expiresAt,
          connectionStatus: "active",
        },
      });
    } else {
      await prisma.oAuthConnection.create({
        data: {
          userId,
          provider: "meta",
          accessToken: encryptSecret(finalToken)!,
          tokenExpiresAt: expiresAt,
          connectionStatus: "active",
        },
      });
    }

    return NextResponse.redirect(new URL("/integrations?success=meta", base));
  } catch (err) {
    reportLogger.warn("Meta OAuth callback failed");
    return NextResponse.redirect(new URL("/integrations?error=meta_server", base));
  }
}
