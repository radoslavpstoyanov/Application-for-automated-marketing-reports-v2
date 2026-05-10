"use client";

import { SessionProvider } from "next-auth/react";
import { SessionHeartbeat } from "./SessionHeartbeat";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionHeartbeat />
      {children}
    </SessionProvider>
  );
}
