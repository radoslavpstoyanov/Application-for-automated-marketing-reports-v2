"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/Toast";
import { AnalyticsChart, MetricTrendChart, SearchConsoleChart, type Ga4Channel, type GscTrendPoint } from "@/components/report/ReportCharts";
import { EmptyDataNotice, KpiGrid, ReportPanel, ReportSection, ReportTable, SectionErrorNotice, SectionLoadingNotice } from "@/components/report/ReportUI";
import { reportLogger } from "@/lib/report/logger";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPosition,
  formatRatio,
  type MetricChange,
} from "@/lib/report/metrics";
import { REPORT_EXTENSION_SECTIONS, REPORT_SECTION_DEFINITIONS, getReportSection, type PreviewSourceType } from "@/lib/report/sections";

interface ReportTheme {
  name: string;
  className: string;
  primary: string;
  medium: string;
  dark: string;
  primaryRgb: [number, number, number];
}

const REPORT_THEMES: Record<string, ReportTheme> = {
  "Lead Group": {
    name: "Lead Group",
    className: "report-theme-lead",
    primary: "#43b370",
    medium: "#246346",
    dark: "#1f5749",
    primaryRgb: [67, 179, 112],
  },
  "Vectory Design": {
    name: "Vectory",
    className: "report-theme-vectory",
    primary: "#3e67a6",
    medium: "#12416e",
    dark: "#23385d",
    primaryRgb: [62, 103, 166],
  },
};

const getReportTheme = (theme: string) => REPORT_THEMES[theme] ?? REPORT_THEMES["Lead Group"];
const SOURCE_API_ENDPOINTS: Record<PreviewSourceType, string> = {
  gsc: "/api/gsc",
  ga4: "/api/ga4",
  google_ads: "/api/google-ads",
  meta_ads: "/api/meta-ads",
};

interface ProjectSource {
  sourceType: string;
  oauthConnectionId: string | null;
  externalAccountId: string;
  externalAccountName?: string;
  primaryConversion?: string | null;
  isEnabled: boolean;
}

interface ProjectNote {
  noteType: string;
  noteText: string;
}

interface GeneratedReport {
  id: string;
  fileName: string;
  fileUrl: string;
  generatedAt: string;
}

interface OAuthConnection {
  id: string;
  provider: string;
  connectionStatus: string;
}

interface ProjectData {
  id: string;
  projectName: string;
  selectedTheme: string | null;
  reportLanguage: string | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  comparisonPeriodStart: string | null;
  comparisonPeriodEnd: string | null;
  pdfTitle: string | null;
  clientLogoUrl: string | null;
}

interface Props {
  project: ProjectData;
  sources: ProjectSource[];
  notes: ProjectNote[];
  oauthConnections: OAuthConnection[];
  reports: GeneratedReport[];
}

interface PreviewData {
  gsc?: {
    kpis: { clicks: number; impressions: number; ctr: number; position: number };
    changes?: { clicks?: MetricChange; impressions?: MetricChange; ctr?: MetricChange; position?: MetricChange };
    trend: GscTrendPoint[];
    topQueries: Array<{ query: string; clicks: number; position: number }>;
    topPages: Array<{ page: string; clicks: number; impressions: number }>;
  };
  ga4?: {
    conversionName: string;
    kpis: { users: number; sessions: number; engagedSessions: number; conversions: number };
    changes?: { users?: MetricChange; sessions?: MetricChange; engagedSessions?: MetricChange; conversions?: MetricChange };
    trend: Array<{ date: string; sessions: number }>;
    channels: Ga4Channel[];
    landingPages: Array<{ page: string; sessions: number; users: number }>;
  };
  google_ads?: {
    conversionName: string;
    kpis: { spend: number; clicks: number; impressions: number; cpc: number; conversions: number; cpa: number; roas: number };
    changes?: { spend?: MetricChange; clicks?: MetricChange; impressions?: MetricChange; cpc?: MetricChange; conversions?: MetricChange; cpa?: MetricChange; roas?: MetricChange };
    trend: Array<{ date: string; spend: number }>;
    campaigns: Array<{ campaign: string; spend: number; clicks: number; impressions: number; conversions: number; cpa: number; roas: number }>;
  };
  meta_ads?: {
    conversionName: string;
    kpis: { spend: number; impressions: number; reach: number; clicks: number; conversions: number; cpa: number; roas: number };
    changes?: { spend?: MetricChange; impressions?: MetricChange; reach?: MetricChange; clicks?: MetricChange; conversions?: MetricChange; cpa?: MetricChange; roas?: MetricChange };
    trend: Array<{ date: string; spend: number }>;
    campaigns: Array<{ campaign: string; spend: number; clicks: number; conversions: number; cpa: number; roas: number }>;
  };
  errors: Partial<Record<"gsc" | "ga4" | "google_ads" | "meta_ads", string>>;
}

interface PreviewSnapshot {
  pdfTitle: string;
  selectedTheme: string;
  clientLogoUrl: string | null;
  reportingStart: string;
  reportingEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
  sources: ProjectSource[];
  notes: ProjectNote[];
}

type ValidationErrors = Record<string, string>;

function getTodayDateInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export default function ProjectClient({ project, sources: initialSources, notes: initialNotes, oauthConnections, reports: initialReports }: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const isGoogleConnected = oauthConnections.some(c => c.provider === "google" && c.connectionStatus === "active");
  const isMetaConnected = oauthConnections.some(c => c.provider === "meta" && c.connectionStatus === "active");
  const [projectName, setProjectName] = useState(project.projectName);
  const [pdfTitle, setPdfTitle] = useState(project.pdfTitle || "Маркетинг Отчет");
  const [selectedTheme, setSelectedTheme] = useState(
    project.selectedTheme && REPORT_THEMES[project.selectedTheme] ? project.selectedTheme : "Lead Group"
  );
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(project.clientLogoUrl);
  
  // Date states
  const [reportingStart, setReportingStart] = useState(project.reportingPeriodStart ? project.reportingPeriodStart.substring(0, 10) : "");
  const [reportingEnd, setReportingEnd] = useState(project.reportingPeriodEnd ? project.reportingPeriodEnd.substring(0, 10) : "");
  const [comparisonStart, setComparisonStart] = useState(project.comparisonPeriodStart ? project.comparisonPeriodStart.substring(0, 10) : "");
  const [comparisonEnd, setComparisonEnd] = useState(project.comparisonPeriodEnd ? project.comparisonPeriodEnd.substring(0, 10) : "");
  const [isComparisonEnabled, setIsComparisonEnabled] = useState(!!(project.comparisonPeriodStart && project.comparisonPeriodEnd));

  const hasComparison = isComparisonEnabled && !!(comparisonStart && comparisonEnd);
  const todayDateValue = getTodayDateInputValue();

  // Active Sources
  const isSourceActive = (type: string) => activeSources.some(s => s.sourceType === type && s.isEnabled);
  const getSourceField = (type: string, field: "externalAccountId" | "externalAccountName") => {
    const found = activeSources.find(s => s.sourceType === type);
    return found ? found[field] : "";
  };
  const getPrimaryConversion = (type: string) =>
    activeSources.find(s => s.sourceType === type)?.primaryConversion ?? "";

  const [activeSources, setActiveSources] = useState<ProjectSource[]>(initialSources);

  const getOAuthConnectionId = (type: string) => {
    const provider = type === "meta_ads" ? "meta" : "google";
    return oauthConnections.find(c => c.provider === provider && c.connectionStatus === "active")?.id ?? null;
  };

  // Notes
  const getNoteText = (type: string) => {
    const found = noteList.find(n => n.noteType === type);
    return found ? found.noteText : "";
  };
  const setNoteText = (type: string, text: string) => {
    setNoteList(prev => {
      const idx = prev.findIndex(n => n.noteType === type);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx].noteText = text;
        return copy;
      } else {
        return [...prev, { noteType: type, noteText: text }];
      }
    });
  };
  const [noteList, setNoteList] = useState<ProjectNote[]>(initialNotes);

  // UI state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData>({ errors: {} });
  const [sectionLoading, setSectionLoading] = useState<Partial<Record<PreviewSourceType, boolean>>>({});
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [toastError, setToastError] = useState("");
  const [toastSuccess, setToastSuccess] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [reportHistory, setReportHistory] = useState<GeneratedReport[]>(initialReports);
  const previewCacheRef = useRef<Map<string, PreviewData>>(new Map());

  const [googleAccounts, setGoogleAccounts] = useState<{ ga4: { id: string; name: string }[]; gsc: { url: string }[]; googleAds: { id: string; name: string }[] }>({
    ga4: [],
    gsc: [],
    googleAds: [],
  });
  const [metaAccounts, setMetaAccounts] = useState<{ id: string; name: string }[]>([]);

  // Fetch real Google/Meta accounts if connected
  useEffect(() => {
    if (isGoogleConnected) {
      fetch("/api/data/google/accounts")
        .then(async res => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Неуспешно зареждане на Google профилите.");
          return data;
        })
        .then(data => {
          if (data.ga4Properties || data.gscSites || data.googleAdsAccounts) {
            setGoogleAccounts({
              ga4: (data.ga4Properties || []).map((p: any) => ({ id: p.id, name: p.name })),
              gsc: (data.gscSites || []).map((s: any) => ({ url: s.siteUrl })),
              googleAds: (data.googleAdsAccounts || []).map((a: any) => ({ id: a.id, name: a.name })),
            });
          }
          if (data.warnings?.length) setToastError(data.warnings.join(" "));
        })
        .catch(err => setToastError(err.message || "Неуспешно зареждане на Google профилите."));
    }

    if (isMetaConnected) {
      fetch("/api/data/meta/accounts")
        .then(async res => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Неуспешно зареждане на Meta профилите.");
          return data;
        })
        .then(data => {
          if (data.adAccounts) {
            setMetaAccounts(data.adAccounts.map((a: any) => ({ id: a.id, name: a.name })));
          }
        })
        .catch(err => setToastError(err.message || "Неуспешно зареждане на Meta профилите."));
    }
  }, [isGoogleConnected, isMetaConnected]);

  const clearValidationErrors = (...keys: string[]) => {
    setValidationErrors((current) => {
      const next = { ...current };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const handleSourceCheckboxChange = (type: string, isChecked: boolean) => {
    clearValidationErrors("sources", `${type}.account`, `${type}.conversion`);
    setActiveSources(prev => {
      const idx = prev.findIndex(s => s.sourceType === type);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx].isEnabled = isChecked;
        copy[idx].oauthConnectionId = getOAuthConnectionId(type);
        return copy;
      } else {
        return [...prev, { sourceType: type, oauthConnectionId: getOAuthConnectionId(type), externalAccountId: "", externalAccountName: "", primaryConversion: null, isEnabled: isChecked }];
      }
    });
  };

  const handleSourceSelectChange = (type: string, id: string, name: string) => {
    clearValidationErrors(`${type}.account`);
    setActiveSources(prev => {
      const idx = prev.findIndex(s => s.sourceType === type);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx].oauthConnectionId = getOAuthConnectionId(type);
        copy[idx].externalAccountId = id;
        copy[idx].externalAccountName = name;
        copy[idx].primaryConversion = null;
        return copy;
      } else {
        return [...prev, { sourceType: type, oauthConnectionId: getOAuthConnectionId(type), externalAccountId: id, externalAccountName: name, primaryConversion: null, isEnabled: true }];
      }
    });
  };

  const handlePrimaryConversionChange = (type: string, conversion: string) => {
    clearValidationErrors(`${type}.conversion`);
    setActiveSources(prev => prev.map(source =>
      source.sourceType === type ? { ...source, primaryConversion: conversion || null } : source
    ));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setClientLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const createPreviewSnapshot = (): PreviewSnapshot => ({
    pdfTitle,
    selectedTheme,
    clientLogoUrl,
    reportingStart,
    reportingEnd,
    comparisonStart: isComparisonEnabled ? comparisonStart : "",
    comparisonEnd: isComparisonEnabled ? comparisonEnd : "",
    sources: activeSources.map((source) => ({ ...source })),
    notes: noteList.map((note) => ({ ...note })),
  });
  const createDataSignature = (snapshot: PreviewSnapshot = createPreviewSnapshot()) => JSON.stringify({
    selectedTheme: snapshot.selectedTheme,
    reportingStart: snapshot.reportingStart,
    reportingEnd: snapshot.reportingEnd,
    comparisonStart: snapshot.comparisonStart,
    comparisonEnd: snapshot.comparisonEnd,
    sources: snapshot.sources
      .filter((source) => source.isEnabled)
      .map((source) => ({
        sourceType: source.sourceType,
        externalAccountId: source.externalAccountId,
        primaryConversion: source.primaryConversion ?? null,
        isEnabled: source.isEnabled,
      }))
      .sort((a, b) => a.sourceType.localeCompare(b.sourceType)),
  });
  const createPreviewSignature = (snapshot: PreviewSnapshot = createPreviewSnapshot()) => JSON.stringify({
    pdfTitle: snapshot.pdfTitle,
    selectedTheme: snapshot.selectedTheme,
    clientLogoUrl: snapshot.clientLogoUrl,
    reportingStart: snapshot.reportingStart,
    reportingEnd: snapshot.reportingEnd,
    comparisonStart: snapshot.comparisonStart,
    comparisonEnd: snapshot.comparisonEnd,
    sources: snapshot.sources
      .map((source) => ({
        sourceType: source.sourceType,
        oauthConnectionId: source.oauthConnectionId ?? null,
        externalAccountId: source.externalAccountId,
        externalAccountName: source.externalAccountName ?? "",
        primaryConversion: source.primaryConversion ?? null,
        isEnabled: source.isEnabled,
      }))
      .sort((a, b) => a.sourceType.localeCompare(b.sourceType)),
    notes: snapshot.notes
      .map((note) => ({
        noteType: note.noteType,
        noteText: note.noteText,
      }))
      .sort((a, b) => a.noteType.localeCompare(b.noteType)),
  });
  const mergePreviewData = (base: PreviewData, addition: PreviewData): PreviewData => ({
    ...(base.gsc ? { gsc: base.gsc } : {}),
    ...(base.ga4 ? { ga4: base.ga4 } : {}),
    ...(base.google_ads ? { google_ads: base.google_ads } : {}),
    ...(base.meta_ads ? { meta_ads: base.meta_ads } : {}),
    ...(addition.gsc ? { gsc: addition.gsc } : {}),
    ...(addition.ga4 ? { ga4: addition.ga4 } : {}),
    ...(addition.google_ads ? { google_ads: addition.google_ads } : {}),
    ...(addition.meta_ads ? { meta_ads: addition.meta_ads } : {}),
    errors: { ...base.errors, ...addition.errors },
  });
  const createPreviewAddition = (sourceType: string, data: unknown): PreviewData => {
    if (sourceType === "gsc") return { gsc: data as PreviewData["gsc"], errors: {} };
    if (sourceType === "ga4") return { ga4: data as PreviewData["ga4"], errors: {} };
    if (sourceType === "google_ads") return { google_ads: data as PreviewData["google_ads"], errors: {} };
    if (sourceType === "meta_ads") return { meta_ads: data as PreviewData["meta_ads"], errors: {} };
    return { errors: {} };
  };

  const validateDateInputs = (requireReportingPeriod = false) => {
    const errors: ValidationErrors = {};

    if (requireReportingPeriod && (!reportingStart || !reportingEnd)) {
      if (!reportingStart) errors.reportingStart = "Моля, изберете начална дата.";
      if (!reportingEnd) errors.reportingEnd = "Моля, изберете крайна дата.";
    }
    if (reportingStart && reportingStart > todayDateValue) {
      errors.reportingStart = "Началната дата не може да бъде в бъдеще.";
    }
    if (reportingEnd && reportingEnd > todayDateValue) {
      errors.reportingEnd = "Крайната дата не може да бъде в бъдеще.";
    }
    if (reportingStart && reportingEnd && reportingStart > reportingEnd) {
      errors.reportingEnd = "Крайната дата трябва да бъде след началната дата.";
    }
    if (isComparisonEnabled && !!comparisonStart !== !!comparisonEnd) {
      if (!comparisonStart) errors.comparisonStart = "Попълнете началната дата за сравнението.";
      if (!comparisonEnd) errors.comparisonEnd = "Попълнете крайната дата за сравнението.";
    }
    if (isComparisonEnabled && comparisonStart && comparisonStart > todayDateValue) {
      errors.comparisonStart = "Началната сравнителна дата не може да бъде в бъдеще.";
    }
    if (isComparisonEnabled && comparisonEnd && comparisonEnd > todayDateValue) {
      errors.comparisonEnd = "Крайната сравнителна дата не може да бъде в бъдеще.";
    }
    if (isComparisonEnabled && comparisonStart && comparisonEnd && comparisonStart > comparisonEnd) {
      errors.comparisonEnd = "Крайната сравнителна дата трябва да бъде след началната.";
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validateDateInputs(false);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setToastError("Коригирайте периода преди запис.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          selectedTheme,
          pdfTitle,
          clientLogoUrl,
          reportingPeriodStart: reportingStart || null,
          reportingPeriodEnd: reportingEnd || null,
          comparisonPeriodStart: isComparisonEnabled ? (comparisonStart || null) : null,
          comparisonPeriodEnd: isComparisonEnabled ? (comparisonEnd || null) : null,
          sources: activeSources,
          notes: noteList,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setToastSuccess("Проектът беше записан успешно!");
        router.refresh();
      } else {
        throw new Error(data.error || "Неуспешен запис на проекта");
      }
    } catch (err: any) {
      setToastError(err.message || "Грешка при запис.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePreview = async () => {
    const errors: ValidationErrors = validateDateInputs(true);
    if (!selectedTheme) {
      errors.theme = "Моля, изберете бранд тема.";
    }

    const enabledSources = activeSources.filter((source) => source.isEnabled);
    if (enabledSources.length === 0) {
      errors.sources = "Активирайте поне един източник на данни.";
    }
    for (const src of enabledSources) {
      if (!src.externalAccountId) {
        errors[`${src.sourceType}.account`] = "Моля, изберете акаунт.";
      }
      if (["ga4", "google_ads", "meta_ads"].includes(src.sourceType) && !src.primaryConversion) {
        errors[`${src.sourceType}.conversion`] = "Моля, изберете основна конверсия.";
      }
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const snapshot = createPreviewSnapshot();
    const dataSignature = createDataSignature(snapshot);
    const previewSnapshotSignature = createPreviewSignature(snapshot);
    const cachedData = previewCacheRef.current.get(dataSignature);
    const sourcesToFetch = snapshot.sources.filter((source) => source.isEnabled);

    setPreviewSnapshot(snapshot);
    setPreviewSignature(previewSnapshotSignature);
    setShowPreview(true);
    setToastError("");

    if (cachedData) {
      reportLogger.debug("Using cached preview data", { sourceCount: sourcesToFetch.length });
      setPreviewData(cachedData);
      setSectionLoading({});
      setIsPreviewLoading(false);
      document.getElementById("preview-anchor")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    reportLogger.debug("Starting preview data request", { sourceCount: sourcesToFetch.length });
    setPreviewData({ errors: {} });
    setIsPreviewLoading(true);
    setSectionLoading(Object.fromEntries(sourcesToFetch.map((source) => [source.sourceType, true])));
    document.getElementById("preview-anchor")?.scrollIntoView({ behavior: "smooth" });

    try {
      const results = await Promise.all(sourcesToFetch.map(async (source) => {
        let addition: PreviewData;
        try {
          const endpoint = SOURCE_API_ENDPOINTS[source.sourceType as PreviewSourceType];
          if (!endpoint) {
            throw new Error("Неподдържан източник на данни.");
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: project.id,
              reportingStart: snapshot.reportingStart,
              reportingEnd: snapshot.reportingEnd,
              comparisonStart: snapshot.comparisonStart || null,
              comparisonEnd: snapshot.comparisonEnd || null,
              externalAccountId: source.externalAccountId,
              oauthConnectionId: source.oauthConnectionId,
              primaryConversion: source.primaryConversion ?? null,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Данните не могат да бъдат заредени.");
          addition = createPreviewAddition(source.sourceType, data);
          reportLogger.debug("Preview source loaded", { sourceType: source.sourceType });
        } catch (err: any) {
          addition = { errors: { [source.sourceType]: err.message || "Данните не могат да бъдат заредени." } };
          reportLogger.warn("Preview source failed", { sourceType: source.sourceType });
        }

        setPreviewData((current) => mergePreviewData(current, addition));
        setSectionLoading((current) => ({ ...current, [source.sourceType]: false }));
        return addition;
      }));

      const completeData = results.reduce((current, addition) => mergePreviewData(current, addition), { errors: {} } as PreviewData);
      if (Object.keys(completeData.errors).length === 0) {
        previewCacheRef.current.set(dataSignature, completeData);
      }
      setPreviewData(completeData);
      reportLogger.debug("Preview data request completed", { hasErrors: Object.keys(completeData.errors).length > 0 });
    } finally {
      setSectionLoading({});
      setIsPreviewLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        throw new Error("Неуспешно изтриване на проекта");
      }
    } catch (err: any) {
      setToastError(err.message);
      setIsDeleting(false);
    }
  };

  const handleDownloadPDF = async () => {
    const reportElement = document.getElementById("printable-report");
    const currentSignature = createPreviewSignature();
    if (!reportElement || !previewSnapshot || previewSignature !== currentSignature) {
      setToastError("Генерирайте нов преглед преди сваляне на отчета.");
      return;
    }

    setIsPdfDownloading(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      if (document.fonts) {
        await document.fonts.ready;
      }

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const exportTheme = getReportTheme(previewSnapshot.selectedTheme);
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const contentWidthMm = 190;
      const contentTopMm = 18;
      const contentBottomMm = 280;
      const contentHeightMm = contentBottomMm - contentTopMm;
      const blocks = Array.from(reportElement.querySelectorAll<HTMLElement>("[data-pdf-order]"))
        .sort((a, b) => Number(a.dataset.pdfOrder) - Number(b.dataset.pdfOrder));

      if (blocks.length === 0) {
        throw new Error("Липсва съдържание за PDF файла.");
      }

      let pageIndex = 0;
      const startPage = () => {
        if (pageIndex > 0) pdf.addPage();
        pageIndex += 1;
      };

      for (const block of blocks) {
        const canvas = await html2canvas(block, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const pixelsPerMm = canvas.width / contentWidthMm;
        const pageHeightPx = Math.floor(contentHeightMm * pixelsPerMm);
        let sourceY = 0;

        while (sourceY < canvas.height) {
          startPage();
          const sliceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;

          const context = pageCanvas.getContext("2d");
          if (!context) {
            throw new Error("Неуспешна подготовка на PDF файла.");
          }

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

          const renderedHeightMm = sliceHeight / pixelsPerMm;
          pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 10, contentTopMm, contentWidthMm, renderedHeightMm);
          sourceY += sliceHeight;
        }
      }

      const accentRgb = exportTheme.primaryRgb;
      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        pdf.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        pdf.rect(10, 11.2, pageWidthMm - 20, 1.2, "F");
        pdf.setLineWidth(0.45);
        pdf.line(10, pageHeightMm - 11, pageWidthMm - 10, pageHeightMm - 11);
        pdf.circle(12.5, pageHeightMm - 6, 1.1, "F");
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.text(exportTheme.name, 10, 8.5);
        pdf.text(`${page} / ${totalPages}`, pageWidthMm - 10, pageHeightMm - 6, { align: "right" });
      }

      const fileName = (previewSnapshot.pdfTitle.trim() || "marketing-report")
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const savedFileName = `${fileName}.pdf`;
      const fileData = pdf.output("datauristring");
      pdf.save(savedFileName);

      try {
        const historyRes = await fetch(`/api/projects/${project.id}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: savedFileName, fileData }),
        });
        const historyData = await historyRes.json().catch(() => ({}));
        if (!historyRes.ok) {
          throw new Error(historyData.error || "Историята на отчета не беше записана.");
        }
        if (historyData.report) {
          setReportHistory((current) => [historyData.report as GeneratedReport, ...current].slice(0, 10));
        }
        setToastSuccess("Отчетът е свален и записан в историята.");
      } catch {
        setToastError("Отчетът е свален, но историята не беше записана.");
      }
    } catch {
      reportLogger.warn("PDF export failed");
      setToastError("Неуспешно генериране на PDF файла.");
    } finally {
      setIsPdfDownloading(false);
    }
  };

  const handleDownloadStoredReport = async (report: GeneratedReport) => {
    if (!report.fileUrl) {
      setToastError("PDF файлът не е наличен за повторно сваляне.");
      return;
    }

    try {
      const response = await fetch(report.fileUrl);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Отчетът не може да бъде свален.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.fileName || "report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setToastError(err.message || "Отчетът не може да бъде свален.");
    }
  };

  const currentPreviewSignature = createPreviewSignature();
  const isPreviewCurrent = showPreview && !!previewSnapshot && previewSignature === currentPreviewSignature;
  const reportSnapshot = previewSnapshot ?? createPreviewSnapshot();
  const reportTheme = getReportTheme(reportSnapshot.selectedTheme);
  const reportThemeAccentColor = reportTheme.primary;
  const reportChartColor = reportTheme.primary;
  const gscSection = getReportSection("gsc");
  const ga4Section = getReportSection("ga4");
  const googleAdsSection = getReportSection("google_ads");
  const metaAdsSection = getReportSection("meta_ads");
  const reportHasComparison = !!(reportSnapshot.comparisonStart && reportSnapshot.comparisonEnd);
  const reportIsSourceActive = (type: string) => reportSnapshot.sources.some((source) => source.sourceType === type && source.isEnabled);
  const reportGetSourceField = (type: string, field: "externalAccountId" | "externalAccountName") =>
    reportSnapshot.sources.find((source) => source.sourceType === type)?.[field] ?? "";
  const reportGetNoteText = (type: string) =>
    reportSnapshot.notes.find((note) => note.noteType === type)?.noteText ?? "";
  const gscHasData = !!previewData.gsc && (
    previewData.gsc.trend.length > 0 ||
    previewData.gsc.topQueries.length > 0 ||
    previewData.gsc.topPages.length > 0 ||
    Object.values(previewData.gsc.kpis).some((value) => value !== 0)
  );
  const ga4HasData = !!previewData.ga4 && (
    previewData.ga4.trend.length > 0 ||
    previewData.ga4.channels.length > 0 ||
    previewData.ga4.landingPages.length > 0 ||
    Object.values(previewData.ga4.kpis).some((value) => value !== 0)
  );
  const googleAdsHasData = !!previewData.google_ads && (
    previewData.google_ads.trend.length > 0 ||
    previewData.google_ads.campaigns.length > 0 ||
    Object.values(previewData.google_ads.kpis).some((value) => value !== 0)
  );
  const metaHasData = !!previewData.meta_ads && (
    previewData.meta_ads.trend.length > 0 ||
    previewData.meta_ads.campaigns.length > 0 ||
    Object.values(previewData.meta_ads.kpis).some((value) => value !== 0)
  );
  const reportSectionIsVisible = (sourceType: PreviewSourceType) => {
    if (sourceType === "gsc") return !!(sectionLoading.gsc || previewData.errors.gsc || previewData.gsc || gscHasData);
    if (sourceType === "ga4") return !!(sectionLoading.ga4 || previewData.errors.ga4 || previewData.ga4 || ga4HasData);
    if (sourceType === "meta_ads") return !!(sectionLoading.meta_ads || previewData.errors.meta_ads || previewData.meta_ads || metaHasData);
    return !!(sectionLoading.google_ads || previewData.errors.google_ads || previewData.google_ads || googleAdsHasData);
  };
  const scrollToPreviewSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const SectionPeriod = () => (
    <p style={{ color: "#64748b", fontSize: "0.84rem", fontWeight: "500", margin: "-0.8rem 0 1.5rem 0" }}>
      Данни от <strong>{reportSnapshot.reportingStart}</strong> - <strong>{reportSnapshot.reportingEnd}</strong>
      {reportHasComparison && <> | Сравнение: <strong>{reportSnapshot.comparisonStart}</strong> - <strong>{reportSnapshot.comparisonEnd}</strong></>}
    </p>
  );
  const SectionSummary = ({ noteType }: { noteType: string }) => {
    const text = reportGetNoteText(noteType);
    if (!text) return null;

    return (
      <div style={{ borderLeft: `4px solid ${reportThemeAccentColor}`, background: "#f8fafc", padding: "1rem", borderRadius: "0.25rem", fontSize: "0.9rem", color: "#334155" }}>
        <p style={{ margin: "0 0 0.45rem 0", fontWeight: "700", fontStyle: "normal" }}>Обобщение</p>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: "1.55" }}>{text}</p>
      </div>
    );
  };
  const InlineError = ({ field }: { field: string }) => validationErrors[field] ? (
    <p className="field-error" role="alert">{validationErrors[field]}</p>
  ) : null;
  const validationBorder = (field: string) => validationErrors[field] ? "#dc2626" : "var(--border)";

  return (
    <div style={{ paddingBottom: "6rem" }}>
      {/* Printable Report Styles Override */}
      <style jsx global>{`
        @keyframes report-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .preview-pages {
          background: #e5e7eb !important;
          border: none !important;
          box-shadow: none !important;
          font-family: "Commissioner", "Segoe UI", Arial, sans-serif !important;
          padding: 1.5rem !important;
        }
        .preview-pages [data-pdf-order] {
          background: #ffffff;
          box-sizing: border-box;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
          break-inside: avoid;
          margin: 0 auto 1.5rem;
          max-width: 794px;
          overflow: hidden;
          page-break-inside: avoid;
          padding: 3.35rem 3rem 4.25rem;
          position: relative;
          scroll-margin-top: 5.5rem;
          width: 100%;
        }
        .preview-pages .pdf-avoid-break,
        .preview-pages h2,
        .preview-pages h3,
        .preview-pages svg {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .preview-pages.report-theme-lead {
          --report-primary: #43b370;
          --report-medium: #246346;
          --report-dark: #1f5749;
        }
        .preview-pages.report-theme-vectory {
          --report-primary: #3e67a6;
          --report-medium: #12416e;
          --report-dark: #23385d;
        }
        .preview-pages .pdf-section::before,
        .preview-pages .pdf-conclusion::before {
          background: var(--report-primary);
          content: "";
          height: 7px;
          left: 0;
          position: absolute;
          right: 0;
          top: 0;
        }
        .preview-pages .pdf-section::after,
        .preview-pages .pdf-conclusion::after {
          border-top: 1px solid #e2e8f0;
          bottom: 1.25rem;
          color: var(--report-medium);
          content: "REPORT / LEAD GROUP";
          font-size: 0.65rem;
          font-weight: 700;
          left: 3rem;
          letter-spacing: 0.16em;
          padding-top: 0.7rem;
          position: absolute;
          right: 3rem;
        }
        .preview-pages.report-theme-vectory .pdf-section::after,
        .preview-pages.report-theme-vectory .pdf-conclusion::after {
          content: "REPORT / VECTORY";
        }
        .preview-pages.report-theme-lead .pdf-section,
        .preview-pages.report-theme-lead .pdf-conclusion {
          background:
            linear-gradient(135deg, transparent 0 50%, rgba(67, 179, 112, 0.05) 50% 100%) right top / 84px 84px no-repeat,
            radial-gradient(circle, rgba(67, 179, 112, 0.3) 1.3px, transparent 1.5px) right 26px top 30px / 9px 9px repeat-y,
            #ffffff;
        }
        .preview-pages.report-theme-vectory .pdf-section,
        .preview-pages.report-theme-vectory .pdf-conclusion {
          background:
            radial-gradient(ellipse at 105% 4%, rgba(62, 103, 166, 0.13), transparent 23%),
            radial-gradient(ellipse at -5% 100%, rgba(18, 65, 110, 0.06), transparent 25%),
            #ffffff;
        }
        .preview-pages .pdf-cover {
          padding: 4rem 3.5rem;
        }
        .preview-pages.report-theme-lead .pdf-cover {
          background:
            radial-gradient(circle at 78% 72%, rgba(67, 179, 112, 0.13) 1.4px, transparent 1.6px) 0 0 / 12px 12px,
            linear-gradient(130deg, #ffffff 0%, #ffffff 54%, rgba(67, 179, 112, 0.08) 100%);
        }
        .preview-pages.report-theme-vectory .pdf-cover {
          background:
            radial-gradient(ellipse at 96% 78%, rgba(62, 103, 166, 0.22), transparent 35%),
            radial-gradient(ellipse at 65% 105%, rgba(18, 65, 110, 0.13), transparent 44%),
            linear-gradient(135deg, #ffffff 0%, #f5f9ff 100%);
        }
        .pdf-cover-brand {
          bottom: 3rem;
          color: var(--report-medium);
          font-size: 0.72rem;
          font-weight: 700;
          left: 3.5rem;
          letter-spacing: 0.22em;
          position: absolute;
          text-transform: uppercase;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .preview-pages [data-pdf-order] {
            box-shadow: none !important;
            margin-bottom: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
        .source-toggle-btn {
          width: 100%;
          padding: 1.25rem;
          border-radius: var(--radius);
          border: 2px solid var(--border);
          background: var(--input);
          color: var(--foreground);
          text-align: center;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          user-select: none;
          font-size: 1rem;
        }
        .source-toggle-btn:hover {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(67, 179, 112, 0.12);
        }
        .source-toggle-btn.active {
          border-color: var(--primary);
          background: rgba(67, 179, 112, 0.08);
          box-shadow: 0 0 0 3px rgba(67, 179, 112, 0.12);
        }
        .field-error {
          color: #b91c1c;
          font-size: 0.78rem;
          font-weight: 600;
          line-height: 1.35;
          margin: 0.4rem 0 0;
        }
        .empty-data-notice {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 0.5rem;
          color: #64748b;
          font-size: 0.85rem;
          margin: 0;
          padding: 0.85rem 1rem;
        }
        .section-loading-notice {
          align-items: center;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          border-radius: 0.5rem;
          color: #334155;
          display: flex;
          font-size: 0.88rem;
          font-weight: 600;
          gap: 0.75rem;
          padding: 1rem;
        }
      `}</style>

      {/* Main Title Section */}
      <header className="no-print" style={{ padding: "2rem 4rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Link href="/dashboard" style={{ color: "var(--muted-foreground)", fontSize: "0.85rem", textDecoration: "none" }}>← Табло</Link>
            <span style={{ color: "var(--muted-foreground)", fontSize: "0.85rem" }}>/</span>
            <span style={{ fontSize: "0.85rem", color: "var(--primary)" }}>{projectName}</span>
          </div>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "2rem",
              fontWeight: "800",
              color: "var(--foreground)",
              marginTop: "0.5rem",
              outline: "none",
              borderBottom: "2px dashed transparent",
              transition: "border 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderBottomColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
          />
        </div>
        
        {/* Top Control Buttons */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="danger" onClick={() => setIsDeleting(true)}>
            Изтрий
          </button>
          <button className="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Записване..." : "Запиши"}
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="container no-print" style={{ marginTop: "3rem", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "3rem" }}>
        
        {/* Left Side: Setup Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Section 1: Brand & Theme Settings */}
          <div className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", fontWeight: "700" }}>1. Бранд и Оформление</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                  PDF Заглавие на отчета
                </label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="Въведете заглавие"
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                    Бранд Тема
                  </label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => { setSelectedTheme(e.target.value); clearValidationErrors("theme"); }}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: `1px solid ${validationBorder("theme")}`, background: "var(--background)", color: "var(--foreground)" }}
                  >
                    <option value="">Изберете тема</option>
                    <option value="Lead Group">Lead Group (Зелена палитра)</option>
                    <option value="Vectory Design">Vectory (Синя палитра)</option>
                  </select>
                  <InlineError field="theme" />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                    Лого на клиента
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    {clientLogoUrl ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={clientLogoUrl}
                          alt="Client Logo"
                          style={{ height: "40px", width: "80px", objectFit: "contain", background: "#f8fafc", padding: "0.2rem", borderRadius: "0.25rem", border: "1px solid var(--border)" }}
                        />
                        <button
                          onClick={() => setClientLogoUrl(null)}
                          style={{ position: "absolute", top: "-8px", right: "-8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                          onChange={handleLogoUpload}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          className="primary"
                          onClick={() => logoInputRef.current?.click()}
                          style={{
                            padding: "0.75rem 1rem",
                            fontSize: "0.85rem",
                          }}
                        >
                          КАЧИ ЛОГО
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Reporting Period */}
          <div className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", fontWeight: "700" }}>2. Период на отчитане</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                    Начална дата
                  </label>
                  <input
                    type="date"
                    min="2000-01-01"
                    max={todayDateValue}
                    value={reportingStart}
                    onChange={(e) => { setReportingStart(e.target.value); clearValidationErrors("reportingStart", "reportingEnd"); }}
                    onKeyDown={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: `1px solid ${validationBorder("reportingStart")}`, background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}
                  />
                  <InlineError field="reportingStart" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                    Крайна дата
                  </label>
                  <input
                    type="date"
                    min="2000-01-01"
                    max={todayDateValue}
                    value={reportingEnd}
                    onChange={(e) => { setReportingEnd(e.target.value); clearValidationErrors("reportingStart", "reportingEnd"); }}
                    onKeyDown={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: `1px solid ${validationBorder("reportingEnd")}`, background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}
                  />
                  <InlineError field="reportingEnd" />
                </div>
              </div>

              <div 
                style={{ 
                  marginTop: "0.5rem",
                  opacity: isComparisonEnabled ? 1 : 0.55,
                  transition: "opacity 0.3s ease",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.95rem", marginBottom: "0.75rem", fontWeight: "600", color: "var(--foreground)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isComparisonEnabled}
                    onChange={(e) => {
                      setIsComparisonEnabled(e.target.checked);
                      clearValidationErrors("comparisonStart", "comparisonEnd");
                    }}
                    style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
                  />
                  Сравнение с предходен период
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                      Начало сравнителен
                    </label>
                    <input
                      type="date"
                      min="2000-01-01"
                      max={todayDateValue}
                      value={comparisonStart}
                      onChange={(e) => { setComparisonStart(e.target.value); clearValidationErrors("comparisonStart", "comparisonEnd"); }}
                      disabled={!isComparisonEnabled}
                      onKeyDown={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                      style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: `1px solid ${validationBorder("comparisonStart")}`, background: "var(--background)", color: "var(--foreground)", cursor: isComparisonEnabled ? "pointer" : "not-allowed" }}
                    />
                    <InlineError field="comparisonStart" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                      Край сравнителен
                    </label>
                    <input
                      type="date"
                      min="2000-01-01"
                      max={todayDateValue}
                      value={comparisonEnd}
                      onChange={(e) => { setComparisonEnd(e.target.value); clearValidationErrors("comparisonStart", "comparisonEnd"); }}
                      disabled={!isComparisonEnabled}
                      onKeyDown={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                      style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: `1px solid ${validationBorder("comparisonEnd")}`, background: "var(--background)", color: "var(--foreground)", cursor: isComparisonEnabled ? "pointer" : "not-allowed" }}
                    />
                    <InlineError field="comparisonEnd" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Data Sources Configuration */}
          <div className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", fontWeight: "700" }}>3. Източници на данни</h3>
            <InlineError field="sources" />
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: validationErrors.sources ? "1rem" : 0 }}>
              {/* Google Search Console */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div 
                  className={`source-toggle-btn ${isSourceActive("gsc") ? "active" : ""}`}
                  onClick={() => handleSourceCheckboxChange("gsc", !isSourceActive("gsc"))}
                >
                  Google Search Console
                </div>
                
                {isSourceActive("gsc") && (
                  <div style={{ padding: "0.5rem 0 1rem 1rem", borderLeft: "2px solid var(--primary)", marginLeft: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                      Изберете сайт
                    </label>
                    <select
                      value={getSourceField("gsc", "externalAccountId")}
                      onChange={(e) => {
                        const opt = googleAccounts.gsc.find(o => o.url === e.target.value);
                        handleSourceSelectChange("gsc", e.target.value, opt?.url || "");
                      }}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("gsc.account")}`, background: "var(--background)", color: "var(--foreground)" }}
                    >
                      <option value="">Изберете сайт</option>
                      {googleAccounts.gsc.map(o => (
                        <option key={o.url} value={o.url}>{o.url}</option>
                      ))}
                    </select>
                    <InlineError field="gsc.account" />
                  </div>
                )}
              </div>

              {/* Google Analytics 4 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div 
                  className={`source-toggle-btn ${isSourceActive("ga4") ? "active" : ""}`}
                  onClick={() => handleSourceCheckboxChange("ga4", !isSourceActive("ga4"))}
                >
                  Google Analytics 4
                </div>
                
                {isSourceActive("ga4") && (
                  <div style={{ padding: "0.5rem 0 1rem 1rem", borderLeft: "2px solid var(--primary)", marginLeft: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Изберете собственост (Property)
                      </label>
                      <select
                        value={getSourceField("ga4", "externalAccountId")}
                        onChange={(e) => {
                          const opt = googleAccounts.ga4.find(o => o.id === e.target.value);
                          handleSourceSelectChange("ga4", e.target.value, opt?.name || "");
                        }}
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("ga4.account")}`, background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <option value="">Изберете GA4</option>
                        {googleAccounts.ga4.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                      <InlineError field="ga4.account" />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Основна конверсия
                      </label>
                      <select
                        value={getPrimaryConversion("ga4")}
                        onChange={(e) => handlePrimaryConversionChange("ga4", e.target.value)}
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("ga4.conversion")}`, background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <option value="">Изберете конверсия</option>
                        <option value="generate_lead">generate_lead</option>
                        <option value="purchase">purchase</option>
                        <option value="page_view">page_view</option>
                      </select>
                      <InlineError field="ga4.conversion" />
                    </div>
                  </div>
                )}
              </div>

              {/* Meta Ads */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div 
                  className={`source-toggle-btn ${isSourceActive("google_ads") ? "active" : ""}`}
                  onClick={() => handleSourceCheckboxChange("google_ads", !isSourceActive("google_ads"))}
                >
                  Google Ads
                </div>
                
                {isSourceActive("google_ads") && (
                  <div style={{ padding: "0.5rem 0 1rem 1rem", borderLeft: "2px solid var(--primary)", marginLeft: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Customer ID
                      </label>
                      {googleAccounts.googleAds.length > 0 ? (
                        <select
                          value={getSourceField("google_ads", "externalAccountId")}
                          onChange={(e) => {
                            const opt = googleAccounts.googleAds.find(o => o.id === e.target.value);
                            handleSourceSelectChange("google_ads", e.target.value, opt?.name || e.target.value);
                          }}
                          style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("google_ads.account")}`, background: "var(--background)", color: "var(--foreground)" }}
                        >
                          <option value="">Изберете Google Ads</option>
                          {googleAccounts.googleAds.map(o => (
                            <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={getSourceField("google_ads", "externalAccountId")}
                          onChange={(e) => handleSourceSelectChange("google_ads", e.target.value, e.target.value)}
                          placeholder="123-456-7890"
                          style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("google_ads.account")}`, background: "var(--background)", color: "var(--foreground)" }}
                        />
                      )}
                      <InlineError field="google_ads.account" />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Основна конверсия
                      </label>
                      <select
                        value={getPrimaryConversion("google_ads")}
                        onChange={(e) => handlePrimaryConversionChange("google_ads", e.target.value)}
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("google_ads.conversion")}`, background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <option value="">Изберете конверсия</option>
                        <option value="generate_lead">generate_lead</option>
                        <option value="purchase">purchase</option>
                        <option value="page_view">page_view</option>
                      </select>
                      <InlineError field="google_ads.conversion" />
                    </div>
                  </div>
                )}
              </div>

              {/* Meta Ads */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div 
                  className={`source-toggle-btn ${isSourceActive("meta_ads") ? "active" : ""}`}
                  onClick={() => handleSourceCheckboxChange("meta_ads", !isSourceActive("meta_ads"))}
                >
                  Meta (Facebook) Ads
                </div>
                
                {isSourceActive("meta_ads") && (
                  <div style={{ padding: "0.5rem 0 1rem 1rem", borderLeft: "2px solid var(--primary)", marginLeft: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Рекламен акаунт
                      </label>
                      <select
                        value={getSourceField("meta_ads", "externalAccountId")}
                      onChange={(e) => {
                          const opt = metaAccounts.find(o => o.id === e.target.value);
                          handleSourceSelectChange("meta_ads", e.target.value, opt?.name || "");
                        }}
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("meta_ads.account")}`, background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <option value="">Изберете акаунт</option>
                        {metaAccounts.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                      <InlineError field="meta_ads.account" />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Основна конверсия
                      </label>
                      <select
                        value={getPrimaryConversion("meta_ads")}
                        onChange={(e) => handlePrimaryConversionChange("meta_ads", e.target.value)}
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: `1px solid ${validationBorder("meta_ads.conversion")}`, background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <option value="">Изберете конверсия</option>
                        <option value="lead">lead</option>
                        <option value="purchase">purchase</option>
                        <option value="link_click">link_click</option>
                      </select>
                      <InlineError field="meta_ads.conversion" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Trigger Block */}
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={handleGeneratePreview}
              className="primary"
              style={{ flex: 1, padding: "1rem", fontSize: "1.1rem", fontWeight: "700" }}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                  <div className="spinner" style={{ width: "20px", height: "20px", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "report-spin 0.8s linear infinite" }} />
                  <span>Генериране на преглед...</span>
                </div>
              ) : (
                "ГЕНЕРИРАЙ ПРЕГЛЕД"
              )}
            </button>
          </div>

        </div>

        {/* Right Side: Quick Notes Config (Instant Side Editing) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div className="glass" style={{ padding: "2rem", borderRadius: "1rem", height: "fit-content" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", fontWeight: "700" }}>Конфигуриране на коментари</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)", marginBottom: "1.5rem" }}>
              Запишете анализи и коментари за всяка активна секция, които да се добавят в крайния PDF.
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {isSourceActive("gsc") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>
                    Google Search Console - Обобщение
                  </label>
                  <textarea
                    rows={4}
                    value={getNoteText("seo")}
                    onChange={(e) => setNoteText("seo", e.target.value)}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    placeholder="Анализ на органичния трафик..."
                  />
                </div>
              )}

              {isSourceActive("ga4") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>
                    Google Analytics 4 - Обобщение
                  </label>
                  <textarea
                    rows={4}
                    value={getNoteText("traffic")}
                    onChange={(e) => setNoteText("traffic", e.target.value)}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    placeholder="Анализ на посещенията и поведението..."
                  />
                </div>
              )}

              {isSourceActive("meta_ads") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>
                    Meta Ads - Обобщение
                  </label>
                  <textarea
                    rows={4}
                    value={getNoteText("meta_ads")}
                    onChange={(e) => setNoteText("meta_ads", e.target.value)}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    placeholder="Анализ на Facebook/Instagram кампаниите..."
                  />
                </div>
              )}

              {isSourceActive("google_ads") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>
                    Google Ads - Обобщение
                  </label>
                  <textarea
                    rows={4}
                    value={getNoteText("google_ads")}
                    onChange={(e) => setNoteText("google_ads", e.target.value)}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    placeholder="Анализ на Google Ads кампаниите..."
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>
                  Заключение
                </label>
                <textarea
                  rows={4}
                  value={getNoteText("final")}
                  onChange={(e) => setNoteText("final", e.target.value)}
                  style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                  placeholder="Обобщение на целия месец..."
                />
              </div>
            </div>
          </div>

          <div className="glass" style={{ padding: "2rem", borderRadius: "1rem", height: "fit-content" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", fontWeight: "700" }}>История на отчети</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)", marginBottom: "1.25rem", lineHeight: "1.5" }}>
              PDF файловете се пазят в базата и могат да се свалят повторно от историята.
            </p>

            {reportHistory.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: "0.9rem" }}>Все още няма свалени отчети за този проект.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {reportHistory.map((report) => (
                  <div key={report.id} style={{ border: "1px solid var(--border)", borderRadius: "0.6rem", padding: "0.85rem", background: "rgba(255,255,255,0.55)" }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: "700", marginBottom: "0.25rem", wordBreak: "break-word" }}>
                      {report.fileName}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
                      {new Date(report.generatedAt).toLocaleString("bg-BG")}
                    </div>
                    {report.fileUrl ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadStoredReport(report)}
                        style={{
                          background: "var(--primary)",
                          borderRadius: "var(--radius)",
                          border: "none",
                          color: "var(--primary-foreground)",
                          display: "inline-block",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          marginTop: "0.65rem",
                          padding: "0.45rem 0.7rem",
                        }}
                      >
                        Свали отново
                      </button>
                    ) : (
                      <div style={{ marginTop: "0.55rem", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                        PDF файлът не е наличен за повторно сваляне.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Anchor for preview scroll */}
      <div id="preview-anchor" />

      {!showPreview && !isPreviewLoading && (
        <div className="container" style={{ marginTop: "4rem" }}>
          <div style={{ background: "#e5e7eb", padding: "4rem 2rem", borderRadius: "1rem", textAlign: "center", color: "#64748b" }}>
            <h3 style={{ color: "#0f172a", fontSize: "1.45rem", marginBottom: "0.75rem" }}>Преглед на отчета</h3>
            <p style={{ margin: 0 }}>Generate preview to see the report</p>
          </div>
        </div>
      )}

      {showPreview && !isPreviewCurrent && !isPreviewLoading && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            top: "1.25rem",
            right: "1.25rem",
            zIndex: 1200,
            width: "310px",
            background: "#fffbeb",
            border: "1px solid #f59e0b",
            borderRadius: "0.75rem",
            padding: "1rem",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.16)",
          }}
        >
          <p style={{ margin: "0 0 0.35rem", color: "#b45309", fontSize: "0.9rem", fontWeight: "700" }}>Preview is outdated</p>
          <p style={{ margin: "0 0 0.8rem", color: "#78350f", fontSize: "0.8rem", lineHeight: "1.4" }}>
            Промените не са приложени към текущия преглед.
          </p>
          <button type="button" className="primary" onClick={handleGeneratePreview} style={{ width: "100%", padding: "0.65rem", fontSize: "0.8rem" }}>
            Генерирай нов преглед
          </button>
        </div>
      )}

      {/* Section 4: Live Printable PDF Report Preview Container */}
      {showPreview && (
        <div className="container" style={{ marginTop: "4rem" }}>
          
          {/* Printable Action Control Bar */}
          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: isPreviewCurrent ? 0 : "0.4rem" }}>Визуален Преглед на Отчета</h3>
              {isPreviewLoading && <span style={{ color: "#2563eb", fontSize: "0.85rem", fontWeight: "700" }}>Generating report...</span>}
              {!isPreviewCurrent && <span style={{ color: "#b45309", fontSize: "0.85rem", fontWeight: "700" }}>Preview is outdated</span>}
            </div>
            <button
              onClick={handleDownloadPDF}
              className="primary"
              disabled={!isPreviewCurrent || isPdfDownloading || isPreviewLoading}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              {isPdfDownloading ? "Генериране..." : "Свали отчет"}
            </button>
          </div>

          <nav className="no-print" style={{ position: "sticky", top: "1rem", zIndex: 30, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.55rem", marginBottom: "1rem", padding: "0.75rem 1rem", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)" }}>
            <span style={{ marginRight: "0.35rem", color: "#64748b", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase" }}>Навигация</span>
            <button type="button" className="secondary" onClick={() => scrollToPreviewSection("preview-cover")} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>Корица</button>
            {REPORT_SECTION_DEFINITIONS.filter((section) => reportIsSourceActive(section.sourceType) && reportSectionIsVisible(section.sourceType)).map((section) => (
              <button key={section.sourceType} type="button" className="secondary" onClick={() => scrollToPreviewSection(section.id)} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>
                {section.navLabel}
              </button>
            ))}
            {REPORT_EXTENSION_SECTIONS.map((section) => (
              <button key={section.id} type="button" className="secondary" onClick={() => scrollToPreviewSection(section.id)} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>
                {section.navLabel}
              </button>
            ))}
            {reportGetNoteText("final") && <button type="button" className="secondary" onClick={() => scrollToPreviewSection("preview-conclusion")} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>Заключение</button>}
          </nav>

            {/* Actual simulated printable PDF sheet */}
            <div
              id="printable-report"
              className={`preview-pages ${reportTheme.className}`}
              style={{
                color: "#1e293b",
                borderRadius: "1rem",
                fontFamily: "'Commissioner', 'Segoe UI', Arial, sans-serif",
              }}
            >
            {/* Header: Logo and Title */}
            <div
              id="preview-cover"
              className="pdf-cover"
              data-pdf-order="0"
              style={{
                minHeight: "640px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: `4px solid ${reportThemeAccentColor}`,
                paddingBottom: "2rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", right: "-110px", bottom: "-110px", width: "340px", height: "340px", borderRadius: "50%", background: reportThemeAccentColor, opacity: 0.08 }} />
              <div style={{ position: "absolute", right: "115px", bottom: "80px", width: "120px", height: "120px", borderRadius: "50%", border: `2px solid ${reportThemeAccentColor}`, opacity: 0.16 }} />
              <div className="pdf-cover-brand">{reportTheme.name} / Marketing Report</div>
              <div>
                <h1 style={{ fontSize: "2.4rem", fontWeight: "800", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
                  {reportSnapshot.pdfTitle}
                </h1>
              </div>

              {reportSnapshot.clientLogoUrl ? (
                <img
                  src={reportSnapshot.clientLogoUrl}
                  alt="Client logo"
                  style={{ maxHeight: "98px", maxWidth: "245px", objectFit: "contain", marginTop: "12px", position: "relative" }}
                />
              ) : (
                <div style={{ padding: "0.5rem 1rem", border: "2px dashed #cbd5e1", borderRadius: "0.35rem", fontSize: "0.8rem", color: "#94a3b8" }}>
                  [Лого на клиента]
                </div>
              )}
            </div>

            {/* Content stream based on enabled sources */}
            <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "3.5rem" }}>
              
              {/* Google Search Console */}
              {reportIsSourceActive("gsc") && (sectionLoading.gsc || previewData.errors.gsc || previewData.gsc || gscHasData) && (
                <ReportSection section={gscSection} accountLabel={reportGetSourceField("gsc", "externalAccountId")} accentColor={reportThemeAccentColor}>
                  <SectionPeriod />
                  
                  {sectionLoading.gsc ? (
                    <SectionLoadingNotice label={gscSection.loadingLabel} accentColor={reportChartColor} />
                  ) : previewData.errors.gsc ? (
                    <SectionErrorNotice message={previewData.errors.gsc} />
                  ) : previewData.gsc && !gscHasData ? (
                    <EmptyDataNotice />
                  ) : previewData.gsc ? (
                    <>
                      <KpiGrid
                        items={[
                          { label: "Кликвания", value: formatNumber(previewData.gsc.kpis.clicks), delta: previewData.gsc.changes?.clicks },
                          { label: "Импресии", value: formatNumber(previewData.gsc.kpis.impressions), delta: previewData.gsc.changes?.impressions },
                          { label: "CTR (Честота)", value: formatPercent(previewData.gsc.kpis.ctr), delta: previewData.gsc.changes?.ctr },
                          { label: "Позиция", value: formatPosition(previewData.gsc.kpis.position), delta: previewData.gsc.changes?.position, invert: true },
                        ]}
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
                        <ReportPanel title="Динамика на кликовете за периода">
                          <SearchConsoleChart accentColor={reportChartColor} trend={previewData.gsc.trend} />
                        </ReportPanel>

                        <ReportPanel title="Топ търсения">
                          <ReportTable
                            rows={previewData.gsc.topQueries}
                            getRowKey={(row) => row.query}
                            columns={[
                              { header: "Ключова дума", render: (row) => row.query },
                              { header: "Кликове", align: "right", render: (row) => <strong>{formatNumber(row.clicks)}</strong> },
                              { header: "Поз.", align: "right", render: (row) => formatPosition(row.position) },
                            ]}
                          />
                        </ReportPanel>
                      </div>

                      <div style={{ marginBottom: "1.5rem" }}>
                        <ReportPanel title="Топ страници">
                          <ReportTable
                            rows={previewData.gsc.topPages}
                            getRowKey={(row) => row.page}
                            columns={[
                              { header: "Страница", render: (row) => <span style={{ wordBreak: "break-all" }}>{row.page}</span> },
                              { header: "Кликове", align: "right", render: (row) => <strong>{formatNumber(row.clicks)}</strong> },
                              { header: "Импресии", align: "right", render: (row) => formatNumber(row.impressions) },
                            ]}
                          />
                        </ReportPanel>
                      </div>
                    </>
                  ) : null}

                  <SectionSummary noteType="seo" />
                </ReportSection>
              )}

              {/* Google Analytics 4 */}
              {reportIsSourceActive("ga4") && (sectionLoading.ga4 || previewData.errors.ga4 || previewData.ga4 || ga4HasData) && (
                <ReportSection section={ga4Section} accountLabel={reportGetSourceField("ga4", "externalAccountName") || reportGetSourceField("ga4", "externalAccountId")} accentColor={reportThemeAccentColor}>
                  <SectionPeriod />
                  
                  {sectionLoading.ga4 ? (
                    <SectionLoadingNotice label={ga4Section.loadingLabel} accentColor={reportChartColor} />
                  ) : previewData.errors.ga4 ? (
                    <SectionErrorNotice message={previewData.errors.ga4} />
                  ) : previewData.ga4 && !ga4HasData ? (
                    <EmptyDataNotice />
                  ) : previewData.ga4 ? (
                    <>
                      <KpiGrid
                        items={[
                          { label: "Потребители", value: formatNumber(previewData.ga4.kpis.users), delta: previewData.ga4.changes?.users },
                          { label: "Сесии", value: formatNumber(previewData.ga4.kpis.sessions), delta: previewData.ga4.changes?.sessions },
                          { label: "Ангажирани сесии", value: formatNumber(previewData.ga4.kpis.engagedSessions), delta: previewData.ga4.changes?.engagedSessions },
                          { label: `Конверсии (${previewData.ga4.conversionName})`, value: formatNumber(previewData.ga4.kpis.conversions), delta: previewData.ga4.changes?.conversions },
                        ]}
                      />

                      <div style={{ marginBottom: "1.5rem" }}>
                        <ReportPanel title="Динамика на сесиите за периода">
                          <MetricTrendChart
                            accentColor={reportChartColor}
                            points={previewData.ga4.trend.map((point) => ({ date: point.date, value: point.sessions }))}
                          />
                        </ReportPanel>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
                        <ReportPanel title="Сесии по основни източници на трафик">
                          <AnalyticsChart accentColor={reportChartColor} channels={previewData.ga4.channels} />
                        </ReportPanel>

                        <ReportPanel title="Резюме на трафика">
                          {previewData.ga4.channels.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
                              {previewData.ga4.channels.map((channel) => (
                                <div key={channel.channel} style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span>{channel.channel}</span>
                                  <span style={{ fontWeight: "700" }}>{formatNumber(channel.sessions)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <EmptyDataNotice />
                          )}
                        </ReportPanel>
                      </div>

                      <div style={{ marginBottom: "1.5rem" }}>
                        <ReportPanel title="Landing Pages">
                          <ReportTable
                            rows={previewData.ga4.landingPages}
                            getRowKey={(row) => row.page}
                            columns={[
                              { header: "Страница", render: (row) => <span style={{ wordBreak: "break-all" }}>{row.page}</span> },
                              { header: "Сесии", align: "right", render: (row) => <strong>{formatNumber(row.sessions)}</strong> },
                              { header: "Потребители", align: "right", render: (row) => formatNumber(row.users) },
                            ]}
                          />
                        </ReportPanel>
                      </div>
                    </>
                  ) : null}

                  <SectionSummary noteType="traffic" />
                </ReportSection>
              )}

              {reportIsSourceActive("google_ads") && (sectionLoading.google_ads || previewData.errors.google_ads || previewData.google_ads || googleAdsHasData) && (
                <ReportSection section={googleAdsSection} accountLabel={reportGetSourceField("google_ads", "externalAccountId")} accentColor={reportThemeAccentColor}>
                  <SectionPeriod />
                  {sectionLoading.google_ads ? (
                    <SectionLoadingNotice label={googleAdsSection.loadingLabel} accentColor={reportChartColor} />
                  ) : previewData.errors.google_ads ? (
                    <SectionErrorNotice message={previewData.errors.google_ads} />
                  ) : previewData.google_ads && !googleAdsHasData ? (
                    <EmptyDataNotice />
                  ) : previewData.google_ads ? (
                    <>
                      <KpiGrid
                        items={[
                          { label: "Бюджет", value: formatCurrency(previewData.google_ads.kpis.spend), delta: previewData.google_ads.changes?.spend },
                          { label: "Кликове", value: formatNumber(previewData.google_ads.kpis.clicks), delta: previewData.google_ads.changes?.clicks },
                          { label: "Импресии", value: formatNumber(previewData.google_ads.kpis.impressions), delta: previewData.google_ads.changes?.impressions },
                          { label: "CPC", value: formatCurrency(previewData.google_ads.kpis.cpc), delta: previewData.google_ads.changes?.cpc, invert: true },
                          { label: `Конверсии (${previewData.google_ads.conversionName})`, value: formatNumber(previewData.google_ads.kpis.conversions), delta: previewData.google_ads.changes?.conversions },
                          { label: "CPA", value: formatCurrency(previewData.google_ads.kpis.cpa), delta: previewData.google_ads.changes?.cpa, invert: true },
                          { label: "ROAS", value: formatRatio(previewData.google_ads.kpis.roas), delta: previewData.google_ads.changes?.roas },
                        ]}
                      />

                      <div style={{ marginBottom: "1.5rem" }}>
                        <ReportPanel title="Динамика на бюджета за периода">
                          <MetricTrendChart
                            accentColor={reportChartColor}
                            points={previewData.google_ads.trend.map((point) => ({ date: point.date, value: point.spend }))}
                          />
                        </ReportPanel>
                      </div>

                      <div style={{ marginBottom: "1.5rem" }}>
                        <ReportPanel title="Кампании">
                          <ReportTable
                            rows={previewData.google_ads.campaigns}
                            getRowKey={(row) => row.campaign}
                            columns={[
                              { header: "Кампания", render: (row) => row.campaign },
                              { header: "Бюджет", align: "right", render: (row) => <strong>{formatCurrency(row.spend)}</strong> },
                              { header: "Кликове", align: "right", render: (row) => formatNumber(row.clicks) },
                              { header: "Импр.", align: "right", render: (row) => formatNumber(row.impressions) },
                              { header: "Конв.", align: "right", render: (row) => formatNumber(row.conversions) },
                              { header: "CPA", align: "right", render: (row) => formatCurrency(row.cpa) },
                              { header: "ROAS", align: "right", render: (row) => formatRatio(row.roas) },
                            ]}
                          />
                        </ReportPanel>
                      </div>

                      <SectionSummary noteType="google_ads" />
                    </>
                  ) : (
                    null
                  )}
                </ReportSection>
              )}

              {/* Meta Ads */}
              {reportIsSourceActive("meta_ads") && (sectionLoading.meta_ads || previewData.errors.meta_ads || previewData.meta_ads || metaHasData) && (
                <ReportSection section={metaAdsSection} accountLabel={reportGetSourceField("meta_ads", "externalAccountName")} accentColor={reportThemeAccentColor}>
                  <SectionPeriod />

                  {sectionLoading.meta_ads ? (
                    <SectionLoadingNotice label={metaAdsSection.loadingLabel} accentColor={reportChartColor} />
                  ) : previewData.errors.meta_ads ? (
                    <SectionErrorNotice message={previewData.errors.meta_ads} />
                  ) : previewData.meta_ads && !metaHasData ? (
                    <EmptyDataNotice />
                  ) : previewData.meta_ads ? (
                    <>
                      <KpiGrid
                        items={[
                          { label: "Бюджет", value: formatCurrency(previewData.meta_ads.kpis.spend), delta: previewData.meta_ads.changes?.spend },
                          { label: "Импресии", value: formatNumber(previewData.meta_ads.kpis.impressions), delta: previewData.meta_ads.changes?.impressions },
                          { label: "Кликове", value: formatNumber(previewData.meta_ads.kpis.clicks), delta: previewData.meta_ads.changes?.clicks },
                          { label: `Конверсии (${previewData.meta_ads.conversionName})`, value: formatNumber(previewData.meta_ads.kpis.conversions), delta: previewData.meta_ads.changes?.conversions },
                          { label: "Обхват", value: formatNumber(previewData.meta_ads.kpis.reach), delta: previewData.meta_ads.changes?.reach },
                          { label: "CPA", value: formatCurrency(previewData.meta_ads.kpis.cpa), delta: previewData.meta_ads.changes?.cpa, invert: true },
                          { label: "ROAS", value: formatRatio(previewData.meta_ads.kpis.roas), delta: previewData.meta_ads.changes?.roas },
                        ]}
                      />
                      <div style={{ marginBottom: "1.5rem" }}>
                        <ReportPanel title="Динамика на бюджета за периода">
                          <MetricTrendChart
                            accentColor={reportChartColor}
                            points={previewData.meta_ads.trend.map((point) => ({ date: point.date, value: point.spend }))}
                          />
                        </ReportPanel>
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <ReportPanel title="Кампании">
                          <ReportTable
                            rows={previewData.meta_ads.campaigns}
                            getRowKey={(row) => row.campaign}
                            columns={[
                              { header: "Кампания", render: (row) => row.campaign },
                              { header: "Бюджет", align: "right", render: (row) => <strong>{formatCurrency(row.spend)}</strong> },
                              { header: "Конв.", align: "right", render: (row) => formatNumber(row.conversions) },
                              { header: "CPA", align: "right", render: (row) => formatCurrency(row.cpa) },
                              { header: "ROAS", align: "right", render: (row) => formatRatio(row.roas) },
                            ]}
                          />
                        </ReportPanel>
                      </div>
                    </>
                  ) : null}

                  <SectionSummary noteType="meta_ads" />
                </ReportSection>
              )}

              {REPORT_EXTENSION_SECTIONS.map((section) => (
                <ReportSection key={section.id} section={section} accentColor={reportThemeAccentColor}>
                  <EmptyDataNotice />
                </ReportSection>
              ))}

            </div>

            {/* Final Section: Summary Conclusion */}
            {reportGetNoteText("final") && (
              <div id="preview-conclusion" className="pdf-conclusion" data-pdf-order="5" style={{ marginTop: "4.5rem", borderTop: "2px solid #f1f5f9", paddingTop: "2.5rem", pageBreakInside: "avoid" }}>
                <h3 style={{ fontSize: "1.35rem", fontWeight: "700", color: "#0f172a", marginBottom: "1rem" }}>
                  Заключение
                </h3>
                <p style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "#334155", whiteSpace: "pre-wrap" }}>
                  {reportGetNoteText("final")}
                </p>
              </div>
            )}
            
            {/* Footer stamp */}
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "4rem", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#94a3b8" }}>
              <span>Генериран от Vectory Reports</span>
              <span>© {new Date().getFullYear()} Всички права запазени</span>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div className="glass" style={{ padding: "2.5rem", borderRadius: "1rem", maxWidth: "420px", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ fontSize: "1.4rem", fontWeight: "700", marginBottom: "1rem" }}>Изтриване на проект</h3>
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.95rem", marginBottom: "2rem" }}>
              Сигурни ли сте, че искате да изтриете проекта <strong>{projectName}</strong>? Това действие е необратимо.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button className="secondary" onClick={() => setIsDeleting(false)}>
                Отказ
              </button>
              <button className="danger" onClick={handleDelete}>
                Да, изтрий проекта
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedbacks */}
      {toastError && <Toast message={toastError} type="error" onClose={() => setToastError("")} />}
      {toastSuccess && <Toast message={toastSuccess} type="success" onClose={() => setToastSuccess("")} />}
    </div>
  );
}
