import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check for session persistence
  if (token.isSessionOnly) {
    const heartbeatCookie = req.cookies.get("vectory-heartbeat");
    if (!heartbeatCookie) {
      // Browser was closed, session cookie is gone.
      // Redirect to login and clear the persistent next-auth cookies.
      const res = NextResponse.redirect(new URL("/login", req.url));
      res.cookies.delete("next-auth.session-token");
      res.cookies.delete("__Secure-next-auth.session-token");
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
  ],
};
