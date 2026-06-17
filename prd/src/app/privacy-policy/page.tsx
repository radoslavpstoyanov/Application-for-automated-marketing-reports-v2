import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Automated Marketing Reports",
  description: "Privacy policy for Automated Marketing Reports.",
};

const sectionStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.75rem",
};

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.65 }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>Privacy Policy</h1>
      <p style={{ color: "var(--muted-foreground)", marginBottom: "2.5rem" }}>
        Last updated: June 17, 2026
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <section style={sectionStyle}>
          <h2>Overview</h2>
          <p>
            Automated Marketing Reports helps users connect marketing data sources and generate reports. This policy
            explains what information is collected and how it is used.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Information We Collect</h2>
          <p>
            We may collect account information such as name, email address, project settings, selected data sources,
            report configuration, OAuth connection records, and generated report history.
          </p>
          <p>
            When users connect Google or Meta integrations, we store access tokens securely so the application can read
            authorized analytics and advertising data on behalf of the user.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>How We Use Information</h2>
          <p>
            Information is used only to authenticate users, load authorized marketing data, prepare report previews,
            generate reports, and maintain report history.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Meta Data</h2>
          <p>
            If a user connects Meta, the application requests read-only access to advertising data such as ad accounts,
            campaign insights, spend, impressions, clicks, conversions, and related report metrics.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Data Sharing</h2>
          <p>
            We do not sell user data. Data is used within the application to provide the reporting service and may be
            processed by hosting, database, and authentication infrastructure required to operate the service.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Data Retention And Deletion</h2>
          <p>
            Users may request deletion of their account data and connected integration data by following the data
            deletion instructions.
          </p>
          <p>
            Data deletion instructions are available at{" "}
            <a href="/data-deletion" style={{ color: "var(--primary-medium)", fontWeight: 700 }}>
              /data-deletion
            </a>
            .
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>Contact</h2>
          <p>
            For privacy questions or deletion requests, contact{" "}
            <a href="mailto:r.stoyanov.p@gmail.com" style={{ color: "var(--primary-medium)", fontWeight: 700 }}>
              r.stoyanov.p@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
