export type PreviewSourceType = "gsc" | "ga4" | "google_ads" | "meta_ads";

export interface ReportSectionDefinition {
  sourceType: string;
  id: string;
  navLabel: string;
  title: string;
  loadingLabel: string;
  order: number;
}

export type DataReportSectionDefinition = ReportSectionDefinition & { sourceType: PreviewSourceType };

export const REPORT_SECTION_DEFINITIONS: readonly DataReportSectionDefinition[] = [
  {
    sourceType: "gsc",
    id: "preview-gsc",
    navLabel: "Search Console",
    title: "Google Search Console",
    loadingLabel: "Google Search Console",
    order: 1,
  },
  {
    sourceType: "google_ads",
    id: "preview-google-ads",
    navLabel: "Google Ads",
    title: "Google Ads",
    loadingLabel: "Google Ads",
    order: 2,
  },
  {
    sourceType: "meta_ads",
    id: "preview-meta",
    navLabel: "Meta Ads",
    title: "Meta (Facebook) Ads",
    loadingLabel: "Meta Ads",
    order: 3,
  },
  {
    sourceType: "ga4",
    id: "preview-ga4",
    navLabel: "GA4",
    title: "Google Analytics 4",
    loadingLabel: "Google Analytics 4",
    order: 4,
  },
];

// Register presentation-only sections here; preview and PDF render them without page changes.
export const REPORT_EXTENSION_SECTIONS: readonly ReportSectionDefinition[] = [];

export function getReportSection(sourceType: PreviewSourceType) {
  const section = REPORT_SECTION_DEFINITIONS.find((item) => item.sourceType === sourceType);
  if (!section) {
    throw new Error(`Unknown report source: ${sourceType}`);
  }
  return section;
}
