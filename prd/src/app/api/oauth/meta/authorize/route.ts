import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/integrations/oauth-state";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  const userId = (session.user as any).id;
  const state = createOAuthState(userId);

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/meta/callback`,
    state,
    scope: "ads_read",
    response_type: "code",
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  );
}
