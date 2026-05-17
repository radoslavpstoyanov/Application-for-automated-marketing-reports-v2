import { PrismaClient } from "@prisma/client";
import { NextResponse, NextRequest } from "next/server";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = process.env.NEXTAUTH_URL!;

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/integrations?error=google_denied", base));
  }

  try {
    // Decode userId from state
    const userId = Buffer.from(state, "base64url").toString();

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${base}/api/oauth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/integrations?error=google_token", base));
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);

    // Upsert OAuthConnection
    const existing = await prisma.oAuthConnection.findFirst({
      where: { userId, provider: "google" },
    });

    if (existing) {
      await prisma.oAuthConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: tokenData.access_token,
          // Only update refresh token if Google sends a new one
          refreshToken: tokenData.refresh_token ?? existing.refreshToken,
          tokenExpiresAt: expiresAt,
          connectionStatus: "active",
        },
      });
    } else {
      await prisma.oAuthConnection.create({
        data: {
          userId,
          provider: "google",
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? null,
          tokenExpiresAt: expiresAt,
          connectionStatus: "active",
        },
      });
    }

    return NextResponse.redirect(new URL("/integrations?success=google", base));
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/integrations?error=google_server", base));
  }
}
