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
      // Set the cookie to expire in 15 seconds
      document.cookie = "vectory-heartbeat=1; path=/; max-age=15";
    };

    // Initial renewal
    renewHeartbeat();

    // Renew every 5 seconds as long as the tab is open
    const interval = setInterval(renewHeartbeat, 5000);

    return () => clearInterval(interval);
  }, [session]);

  return null; // This component doesn't render anything
}
