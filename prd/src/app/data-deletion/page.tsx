import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | Automated Marketing Reports",
  description: "Instructions for requesting data deletion from Automated Marketing Reports.",
};

const sectionStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.75rem",
};

export default function DataDeletionPage() {
  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.65 }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>Data Deletion Instructions</h1>
      <p style={{ color: "var(--muted-foreground)", marginBottom: "2.5rem" }}>
        Last updated: June 17, 2026
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <section style={sectionStyle}>
          <h2>How To Request Deletion</h2>
          <p>
            To request deletion of your Automated Marketing Reports account data, send an email to{" "}
            <a href="mailto:r.stoyanov.p@gmail.com" style={{ color: "var(--primary-medium)", fontWeight: 700 }}>
              r.stoyanov.p@gmail.com
            </a>{" "}
            with the subject line <strong>Data deletion request</strong>.
          </p>
          <p>
            Include the email address used for your application account and mention whether you want all account data
            deleted or only connected integration data removed.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>What Will Be Deleted</h2>
          <p>
            Deletion may include user profile data, OAuth integration tokens, connected account references, project
            configuration, report notes, and generated report history associated with the requesting account.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Meta Integration Data</h2>
          <p>
            If you connected Meta, we will remove stored Meta access tokens and Meta account references associated with
            your application account. The application does not delete data inside your Meta Business, Facebook, Instagram,
            or Ads Manager accounts.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Processing Time</h2>
          <p>
            Deletion requests are reviewed and processed within 30 days. We may ask for confirmation to verify that the
            request comes from the owner of the account.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Alternative</h2>
          <p>
            Users can also disconnect Google or Meta integrations from the Integrations page inside the application.
            Disconnecting an integration removes the active connection from future report generation.
          </p>
        </section>
      </div>
    </main>
  );
}
