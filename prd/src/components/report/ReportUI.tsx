import type { ReactNode } from "react";
import type { MetricChange } from "@/lib/report/metrics";
import { formatMetricChange } from "@/lib/report/metrics";
import type { ReportSectionDefinition } from "@/lib/report/sections";

export interface KpiItem {
  label: string;
  value: string;
  delta?: MetricChange;
  invert?: boolean;
}

export function ComparisonChange({ change, invert = false }: { change?: MetricChange; invert?: boolean }) {
  if (!change) return null;

  const improved = invert ? change.absolute <= 0 : change.absolute >= 0;

  return (
    <span style={{ fontSize: "0.78rem", color: improved ? "#16a34a" : "#dc2626", fontWeight: "600" }}>
      {formatMetricChange(change)} {change.absolute >= 0 ? "↑" : "↓"}
    </span>
  );
}

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.2rem", marginBottom: "2rem" }}>
      {items.map(({ label, value, delta, invert }) => (
        <div key={label} style={{ background: "#f8fafc", padding: "1.2rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: "1.65rem", fontWeight: "700", marginTop: "0.35rem" }}>{value}</div>
          <ComparisonChange change={delta} invert={invert} />
        </div>
      ))}
    </div>
  );
}

export function ReportSection({
  section,
  accountLabel,
  accentColor,
  children,
}: {
  section: ReportSectionDefinition;
  accountLabel?: string;
  accentColor: string;
  children: ReactNode;
}) {
  return (
    <section id={section.id} className="pdf-section" data-pdf-order={section.order} style={{ pageBreakInside: "avoid", order: section.order }}>
      <h2 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
        <span style={{ color: accentColor }}>●</span> {section.title}{accountLabel ? ` (${accountLabel})` : ""}
      </h2>
      {children}
    </section>
  );
}

export function ReportPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ border: "1px solid #f1f5f9", padding: "1.25rem", borderRadius: "0.5rem" }}>
      <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>{title}</p>
      {children}
    </div>
  );
}

export interface ReportTableColumn<Row> {
  header: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
}

export function ReportTable<Row>({
  rows,
  columns,
  getRowKey,
}: {
  rows: Row[];
  columns: ReportTableColumn<Row>[];
  getRowKey: (row: Row) => string;
}) {
  if (rows.length === 0) return <EmptyDataNotice />;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
          {columns.map((column) => (
            <th key={column.header} style={{ paddingBottom: "0.4rem", textAlign: column.align ?? "left" }}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={getRowKey(row)} style={{ borderBottom: "1px solid #f8fafc" }}>
            {columns.map((column) => (
              <td key={column.header} style={{ padding: "0.4rem 0", textAlign: column.align ?? "left" }}>
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmptyDataNotice() {
  return <p className="empty-data-notice">Няма налични данни за избрания период.</p>;
}

export function SectionErrorNotice({ message }: { message: string }) {
  return (
    <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.5rem", padding: "1rem", color: "#be123c", marginBottom: "1.5rem" }}>
      {message}
    </div>
  );
}

export function SectionLoadingNotice({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <div className="section-loading-notice" role="status" aria-live="polite">
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "16px",
          height: "16px",
          border: `2px solid ${accentColor}35`,
          borderTopColor: accentColor,
          borderRadius: "50%",
          animation: "report-spin 0.75s linear infinite",
        }}
      />
      Зареждане на данни от {label}...
    </div>
  );
}
