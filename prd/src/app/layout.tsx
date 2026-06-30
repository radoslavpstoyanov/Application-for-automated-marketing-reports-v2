import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Lead Desing",
  description: "Generate professional marketing reports in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
