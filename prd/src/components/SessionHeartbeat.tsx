"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function SessionHeartbeat() {
  const { data: session } = useSession();

  useEffect(() => {
    // Check if the current user session is marked as "session only" (Remember Me was false)
    const isSessionOnly = session?.user && (session.user as any).isSessionOnly;

    if (!isSessionOnly) return;

    // Function to renew the cookie
    const renewHeartbeat = () => {
      // Keep this as a browser-session cookie so it disappears when the browser session ends.
      document.cookie = "vectory-heartbeat=1; path=/; SameSite=Lax";
    };

    // Initial renewal
    renewHeartbeat();

    // Re-assert periodically in case the browser clears transient cookies while the tab is open.
    const interval = setInterval(renewHeartbeat, 30000);

    return () => clearInterval(interval);
  }, [session]);

  return null; // This component doesn't render anything
}
