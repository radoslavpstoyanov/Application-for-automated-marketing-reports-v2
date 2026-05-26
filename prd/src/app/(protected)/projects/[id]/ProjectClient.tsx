"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/Toast";

// SVG Charts & Helpers
const formatNumber = (value: number) => new Intl.NumberFormat("bg-BG").format(value);
const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatPosition = (value: number) => value.toFixed(1);
const formatCurrency = (value: number) => `${new Intl.NumberFormat("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} лв.`;
const formatRatio = (value: number) => `${value.toFixed(2)}x`;

interface MetricChange {
  absolute: number;
  percent: number | null;
}

const ComparisonChange = ({ change, invert = false }: { change?: MetricChange; invert?: boolean }) => {
  if (!change) return null;
  const improved = invert ? change.absolute <= 0 : change.absolute >= 0;
  const text = change.percent === null
    ? `${change.absolute >= 0 ? "+" : ""}${formatNumber(change.absolute)}`
    : `${change.percent >= 0 ? "+" : ""}${(change.percent * 100).toFixed(1)}%`;

  return (
    <span style={{ fontSize: "0.78rem", color: improved ? "#16a34a" : "#dc2626", fontWeight: "600" }}>
      {text} {change.absolute >= 0 ? "↑" : "↓"}
    </span>
  );
};

interface GscTrendPoint {
  date: string;
  clicks: number;
}

const SearchConsoleChart = ({ accentColor, trend }: { accentColor: string; trend: GscTrendPoint[] }) => {
  if (trend.length === 0) {
    return <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Няма данни за избрания период.</p>;
  }

  const maxClicks = Math.max(...trend.map((point) => point.clicks), 1);
  const points = trend.map((point, index) => ({
    x: 50 + (trend.length === 1 ? 200 : (index * 400) / (trend.length - 1)),
    y: 170 - (point.clicks / maxClicks) * 140,
    label: point.date.slice(5).split("-").reverse().join("."),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `50,170 ${line} ${points[points.length - 1].x},170`;
  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));

  return (
    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <line x1="50" y1="30" x2="450" y2="30" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="100" x2="450" y2="100" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="170" x2="450" y2="170" stroke="#cbd5e1" strokeWidth="1" />
      <polygon points={area} fill={accentColor} opacity="0.15" />
      <polyline points={line} fill="none" stroke={accentColor} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill="#fff" stroke={accentColor} strokeWidth="2" />
      ))}
      {labelIndexes.map((index) => (
        <text key={points[index].label} x={points[index].x} y="190" fontSize="10" fill="#94a3b8" textAnchor="middle">
          {points[index].label}
        </text>
      ))}
    </svg>
  );
};

interface Ga4Channel {
  channel: string;
  sessions: number;
}

const AnalyticsChart = ({ accentColor, channels }: { accentColor: string; channels: Ga4Channel[] }) => {
  if (channels.length === 0) {
    return <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Няма данни за избрания период.</p>;
  }

  const maxSessions = Math.max(...channels.map((channel) => channel.sessions), 1);
  const columnWidth = 55;

  return (
    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <line x1="35" y1="170" x2="470" y2="170" stroke="#cbd5e1" strokeWidth="1" />
      {channels.slice(0, 4).map((channel, index) => {
        const x = 60 + index * 102;
        const height = (channel.sessions / maxSessions) * 125;
        return (
          <g key={channel.channel}>
            <rect x={x} y={170 - height} width={columnWidth} height={height} rx="4" fill={accentColor} />
            <text x={x + columnWidth / 2} y="188" fontSize="9" fill="#64748b" textAnchor="middle">
              {channel.channel.length > 13 ? `${channel.channel.slice(0, 12)}...` : channel.channel}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

interface MetricTrendPoint {
  date: string;
  value: number;
}

const formatTrendDate = (date: string) => {
  if (date.length === 8 && !date.includes("-")) {
    return `${date.slice(6, 8)}.${date.slice(4, 6)}`;
  }

  return date.slice(5).split("-").reverse().join(".");
};

const MetricTrendChart = ({ accentColor, points }: { accentColor: string; points: MetricTrendPoint[] }) => {
  if (points.length === 0) {
    return <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Няма данни за избрания период.</p>;
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const plotted = points.map((point, index) => ({
    x: 50 + (points.length === 1 ? 200 : (index * 400) / (points.length - 1)),
    y: 170 - (point.value / maxValue) * 140,
    label: formatTrendDate(point.date),
  }));
  const line = plotted.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `50,170 ${line} ${plotted[plotted.length - 1].x},170`;
  const labelIndexes = Array.from(new Set([0, Math.floor((plotted.length - 1) / 2), plotted.length - 1]));

  return (
    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <line x1="50" y1="30" x2="450" y2="30" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="100" x2="450" y2="100" stroke="#f1f5f9" strokeWidth="1" />
      <line x1="50" y1="170" x2="450" y2="170" stroke="#cbd5e1" strokeWidth="1" />
      <polygon points={area} fill={accentColor} opacity="0.15" />
      <polyline points={line} fill="none" stroke={accentColor} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      {plotted.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill="#fff" stroke={accentColor} strokeWidth="2" />
      ))}
      {labelIndexes.map((index) => (
        <text key={plotted[index].label} x={plotted[index].x} y="190" fontSize="10" fill="#94a3b8" textAnchor="middle">
          {plotted[index].label}
        </text>
      ))}
    </svg>
  );
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

export default function ProjectClient({ project, sources: initialSources, notes: initialNotes, oauthConnections }: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const isGoogleConnected = oauthConnections.some(c => c.provider === "google" && c.connectionStatus === "active");
  const isMetaConnected = oauthConnections.some(c => c.provider === "meta" && c.connectionStatus === "active");
  const [projectName, setProjectName] = useState(project.projectName);
  const [pdfTitle, setPdfTitle] = useState(project.pdfTitle || "Маркетинг Отчет");
  const [selectedTheme, setSelectedTheme] = useState(project.selectedTheme || "Lead Group");
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(project.clientLogoUrl);
  
  // Date states
  const [reportingStart, setReportingStart] = useState(project.reportingPeriodStart ? project.reportingPeriodStart.substring(0, 10) : "");
  const [reportingEnd, setReportingEnd] = useState(project.reportingPeriodEnd ? project.reportingPeriodEnd.substring(0, 10) : "");
  const [comparisonStart, setComparisonStart] = useState(project.comparisonPeriodStart ? project.comparisonPeriodStart.substring(0, 10) : "");
  const [comparisonEnd, setComparisonEnd] = useState(project.comparisonPeriodEnd ? project.comparisonPeriodEnd.substring(0, 10) : "");
  const [isComparisonFocused, setIsComparisonFocused] = useState(false);

  const hasComparison = !!(comparisonStart && comparisonEnd);
  const isComparisonActive = !!(comparisonStart || comparisonEnd || isComparisonFocused);

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
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData>({ errors: {} });
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [toastError, setToastError] = useState("");
  const [toastSuccess, setToastSuccess] = useState("");

  const [googleAccounts, setGoogleAccounts] = useState<{ ga4: { id: string; name: string }[]; gsc: { url: string }[] }>({
    ga4: [],
    gsc: [],
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
          if (data.ga4Properties || data.gscSites) {
            setGoogleAccounts({
              ga4: data.ga4Properties.map((p: any) => ({ id: p.id, name: p.name })),
              gsc: data.gscSites.map((s: any) => ({ url: s.siteUrl }))
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

  const handleSourceCheckboxChange = (type: string, isChecked: boolean) => {
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
    setActiveSources(prev => {
      const idx = prev.findIndex(s => s.sourceType === type);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx].oauthConnectionId = getOAuthConnectionId(type);
        copy[idx].externalAccountId = id;
        copy[idx].externalAccountName = name;
        return copy;
      } else {
        return [...prev, { sourceType: type, oauthConnectionId: getOAuthConnectionId(type), externalAccountId: id, externalAccountName: name, primaryConversion: null, isEnabled: true }];
      }
    });
  };

  const handlePrimaryConversionChange = (type: string, conversion: string) => {
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
    comparisonStart,
    comparisonEnd,
    sources: activeSources.map((source) => ({ ...source })),
    notes: noteList.map((note) => ({ ...note })),
  });

  const handleSave = async () => {
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
          comparisonPeriodStart: comparisonStart || null,
          comparisonPeriodEnd: comparisonEnd || null,
          sources: activeSources,
          notes: noteList,
        }),
      });

      if (res.ok) {
        setToastSuccess("Проектът беше записан успешно!");
        router.refresh();
      } else {
        throw new Error("Неуспешен запис на проекта");
      }
    } catch (err: any) {
      setToastError(err.message || "Грешка при запис.");
    }
  };

  const handleGeneratePreview = async () => {
    // Validations
    if (!reportingStart || !reportingEnd) {
      setToastError("Моля, изберете основен период на отчитане.");
      return;
    }
    if (reportingStart > reportingEnd) {
      setToastError("Началната дата на отчета трябва да е преди крайната дата.");
      return;
    }
    if (!!comparisonStart !== !!comparisonEnd) {
      setToastError("Моля, попълнете и двете дати за сравнителния период.");
      return;
    }
    if (comparisonStart && comparisonEnd && comparisonStart > comparisonEnd) {
      setToastError("Началната дата на сравнението трябва да е преди крайната дата.");
      return;
    }
    
    // Check conversions / properties validation
    for (const src of activeSources) {
      if (src.isEnabled && !src.externalAccountId) {
        setToastError(`Моля, изберете акаунт/собственост за активния източник: ${src.sourceType.toUpperCase()}`);
        return;
      }
      if (src.isEnabled && ["ga4", "google_ads", "meta_ads"].includes(src.sourceType) && !src.primaryConversion) {
        setToastError(`Моля, изберете основна конверсия за активния източник: ${src.sourceType.toUpperCase()}`);
        return;
      }
    }

    setIsPreviewLoading(true);
    setShowPreview(false);

    try {
      const response = await fetch(`/api/projects/${project.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingStart,
          reportingEnd,
          comparisonStart: comparisonStart || null,
          comparisonEnd: comparisonEnd || null,
          sources: activeSources,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Неуспешно генериране на преглед.");
      }

      const snapshot = createPreviewSnapshot();
      setPreviewData(data);
      setPreviewSnapshot(snapshot);
      setPreviewSignature(JSON.stringify(snapshot));
      setShowPreview(true);
      const sourceErrors = Object.values(data.errors ?? {}).filter(Boolean) as string[];
      if (sourceErrors.length > 0) {
        setToastError(sourceErrors.join(" "));
      }
      document.getElementById("preview-anchor")?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      setToastError(err.message || "Неуспешно генериране на преглед.");
    } finally {
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
    const currentSignature = JSON.stringify(createPreviewSnapshot());
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

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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

      const accentRgb = previewSnapshot.selectedTheme === "Lead Group" ? [30, 64, 175] : [13, 148, 136];
      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        pdf.setLineWidth(0.7);
        pdf.line(10, 12, pageWidthMm - 10, 12);
        pdf.line(10, pageHeightMm - 11, pageWidthMm - 10, pageHeightMm - 11);
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.text(previewSnapshot.selectedTheme, 10, 9);
        pdf.text(`${page} / ${totalPages}`, pageWidthMm - 10, pageHeightMm - 6, { align: "right" });
      }

      const fileName = (previewSnapshot.pdfTitle.trim() || "marketing-report")
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      setToastError("Неуспешно генериране на PDF файла.");
    } finally {
      setIsPdfDownloading(false);
    }
  };

  const themeAccentColor = selectedTheme === "Lead Group" ? "#1e40af" : "#0d9488";
  const currentPreviewSignature = JSON.stringify(createPreviewSnapshot());
  const isPreviewCurrent = showPreview && !!previewSnapshot && previewSignature === currentPreviewSignature;
  const reportSnapshot = previewSnapshot ?? createPreviewSnapshot();
  const reportThemeAccentColor = reportSnapshot.selectedTheme === "Lead Group" ? "#1e40af" : "#0d9488";
  const reportHasComparison = !!(reportSnapshot.comparisonStart && reportSnapshot.comparisonEnd);
  const reportIsSourceActive = (type: string) => reportSnapshot.sources.some((source) => source.sourceType === type && source.isEnabled);
  const reportGetSourceField = (type: string, field: "externalAccountId" | "externalAccountName") =>
    reportSnapshot.sources.find((source) => source.sourceType === type)?.[field] ?? "";
  const reportGetNoteText = (type: string) =>
    reportSnapshot.notes.find((note) => note.noteType === type)?.noteText ?? "";
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
          padding: 1.5rem !important;
        }
        .preview-pages [data-pdf-order] {
          background: #ffffff;
          box-sizing: border-box;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
          margin: 0 auto 1.5rem;
          max-width: 794px;
          padding: 3rem;
          scroll-margin-top: 5.5rem;
          width: 100%;
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
          box-shadow: 0 0 10px rgba(0, 223, 154, 0.15);
        }
        .source-toggle-btn.active {
          border-color: var(--primary);
          background: rgba(0, 223, 154, 0.05);
          box-shadow: 0 0 15px rgba(0, 223, 154, 0.25);
        }
      `}</style>

      {/* Main Title Section */}
      <header className="no-print" style={{ padding: "2rem 4rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
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
          <button className="secondary" style={{ color: "#ef4444" }} onClick={() => setIsDeleting(true)}>
            Изтрий
          </button>
          <button className="primary" onClick={handleSave}>
            Запиши
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
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                  >
                    <option value="Lead Group">Lead Group (Тъмно синьо)</option>
                    <option value="Vectory Design">Vectory Design (Тюркоаз)</option>
                  </select>
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
                    value={reportingStart}
                    onChange={(e) => setReportingStart(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                    Крайна дата
                  </label>
                  <input
                    type="date"
                    min="2000-01-01"
                    value={reportingEnd}
                    onChange={(e) => setReportingEnd(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}
                  />
                </div>
              </div>

              <div 
                style={{ 
                  marginTop: "0.5rem",
                  opacity: isComparisonActive ? 1 : 0.5, 
                  transition: "opacity 0.3s ease",
                }}
              >
                <div style={{ display: "block", fontSize: "0.95rem", marginBottom: "0.75rem", fontWeight: "600", color: "var(--foreground)" }}>
                  Сравнение с предходен период
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                      Начало сравнителен
                    </label>
                    <input
                      type="date"
                      min="2000-01-01"
                      value={comparisonStart}
                      onChange={(e) => setComparisonStart(e.target.value)}
                      onFocus={() => setIsComparisonFocused(true)}
                      onBlur={() => setIsComparisonFocused(false)}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                      style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "600" }}>
                      Край сравнителен
                    </label>
                    <input
                      type="date"
                      min="2000-01-01"
                      value={comparisonEnd}
                      onChange={(e) => setComparisonEnd(e.target.value)}
                      onFocus={() => setIsComparisonFocused(true)}
                      onBlur={() => setIsComparisonFocused(false)}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                      style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Data Sources Configuration */}
          <div className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", fontWeight: "700" }}>3. Източници на данни</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                    >
                      <option value="">-- Изберете сайт --</option>
                      {googleAccounts.gsc.map(o => (
                        <option key={o.url} value={o.url}>{o.url}</option>
                      ))}
                    </select>
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
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <option value="">-- Изберете GA4 --</option>
                        {googleAccounts.ga4.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Основна конверсия
                      </label>
                      <input
                        list="ga4-conversion-options"
                        value={getPrimaryConversion("ga4")}
                        onChange={(e) => handlePrimaryConversionChange("ga4", e.target.value)}
                        placeholder="напр. generate_lead"
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      />
                      <datalist id="ga4-conversion-options">
                        <option value="generate_lead" />
                        <option value="purchase" />
                        <option value="page_view" />
                      </datalist>
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
                      <input
                        value={getSourceField("google_ads", "externalAccountId")}
                        onChange={(e) => handleSourceSelectChange("google_ads", e.target.value, e.target.value)}
                        placeholder="123-456-7890"
                        style={{ padding: "0.6rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Основна конверсия
                      </label>
                      <input
                        value={getPrimaryConversion("google_ads")}
                        onChange={(e) => handlePrimaryConversionChange("google_ads", e.target.value)}
                        placeholder="Lead form submit"
                        style={{ padding: "0.6rem" }}
                      />
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
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <option value="">-- Изберете акаунт --</option>
                        {metaAccounts.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.4rem", color: "var(--muted-foreground)" }}>
                        Основна конверсия
                      </label>
                      <input
                        list="meta-conversion-options"
                        value={getPrimaryConversion("meta_ads")}
                        onChange={(e) => handlePrimaryConversionChange("meta_ads", e.target.value)}
                        placeholder="напр. lead"
                        style={{ width: "100%", padding: "0.6rem", borderRadius: "0.35rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      />
                      <datalist id="meta-conversion-options">
                        <option value="lead" />
                        <option value="purchase" />
                        <option value="link_click" />
                      </datalist>
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

      {isPreviewLoading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15, 23, 42, 0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#ffffff", borderRadius: "0.9rem", padding: "1.75rem 2.25rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", boxShadow: "0 22px 45px rgba(15, 23, 42, 0.25)" }}>
            <div className="spinner" style={{ width: "34px", height: "34px", border: "4px solid #e2e8f0", borderTopColor: themeAccentColor, borderRadius: "50%", animation: "report-spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, fontWeight: "700", color: "#0f172a" }}>Generating report...</p>
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
              {!isPreviewCurrent && <span style={{ color: "#b45309", fontSize: "0.85rem", fontWeight: "700" }}>Preview is outdated</span>}
            </div>
            <button
              onClick={isPreviewCurrent ? handleDownloadPDF : handleGeneratePreview}
              className="primary"
              disabled={isPdfDownloading || isPreviewLoading}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              {isPdfDownloading ? "Генериране..." : isPreviewLoading ? "Обновяване..." : isPreviewCurrent ? "Свали отчет" : "Генерирай нов преглед"}
            </button>
          </div>

          <nav className="no-print" style={{ position: "sticky", top: "1rem", zIndex: 30, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.55rem", marginBottom: "1rem", padding: "0.75rem 1rem", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)" }}>
            <span style={{ marginRight: "0.35rem", color: "#64748b", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase" }}>Навигация</span>
            <button type="button" className="secondary" onClick={() => scrollToPreviewSection("preview-cover")} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>Корица</button>
            {reportIsSourceActive("gsc") && previewData.gsc && <button type="button" className="secondary" onClick={() => scrollToPreviewSection("preview-gsc")} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>Search Console</button>}
            {reportIsSourceActive("meta_ads") && previewData.meta_ads && <button type="button" className="secondary" onClick={() => scrollToPreviewSection("preview-meta")} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>Meta Ads</button>}
            {reportIsSourceActive("ga4") && previewData.ga4 && <button type="button" className="secondary" onClick={() => scrollToPreviewSection("preview-ga4")} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>GA4</button>}
            {reportGetNoteText("final") && <button type="button" className="secondary" onClick={() => scrollToPreviewSection("preview-conclusion")} style={{ padding: "0.55rem 0.7rem", fontSize: "0.78rem", textTransform: "none" }}>Заключение</button>}
          </nav>

            {/* Actual simulated printable PDF sheet */}
            <div
              id="printable-report"
              className="preview-pages"
              style={{
                color: "#1e293b",
                borderRadius: "1rem",
                fontFamily: "'Outfit', 'Inter', sans-serif",
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
              {reportIsSourceActive("gsc") && previewData.gsc && (
                <div id="preview-gsc" className="pdf-section" data-pdf-order="1" style={{ pageBreakInside: "avoid", order: 1 }}>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
                    <span style={{ color: reportThemeAccentColor }}>●</span> Google Search Console ({reportGetSourceField("gsc", "externalAccountId")})
                  </h2>
                  <SectionPeriod />
                  
                  {previewData.errors.gsc ? (
                    <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.5rem", padding: "1rem", color: "#be123c", marginBottom: "1.5rem" }}>
                      {previewData.errors.gsc}
                    </div>
                  ) : previewData.gsc ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem", marginBottom: "2rem" }}>
                        {[
                          { label: "Кликвания", value: formatNumber(previewData.gsc.kpis.clicks), delta: previewData.gsc.changes?.clicks },
                          { label: "Импресии", value: formatNumber(previewData.gsc.kpis.impressions), delta: previewData.gsc.changes?.impressions },
                          { label: "CTR (Честота)", value: formatPercent(previewData.gsc.kpis.ctr), delta: previewData.gsc.changes?.ctr },
                          { label: "Позиция", value: formatPosition(previewData.gsc.kpis.position), delta: previewData.gsc.changes?.position, invert: true },
                        ].map(({ label, value, delta, invert }) => (
                          <div key={label} style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>{label}</span>
                            <p style={{ fontSize: "1.6rem", fontWeight: "700", margin: "0.25rem 0 0 0", color: "#0f172a" }}>{value}</p>
                            <ComparisonChange change={delta} invert={invert} />
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
                        <div style={{ border: "1px solid #f1f5f9", padding: "1rem", borderRadius: "0.5rem" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Динамика на кликовете за периода</p>
                          <SearchConsoleChart accentColor={reportThemeAccentColor} trend={previewData.gsc.trend} />
                        </div>

                        <div style={{ border: "1px solid #f1f5f9", padding: "1.25rem", borderRadius: "0.5rem" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Топ търсения</p>
                          {previewData.gsc.topQueries.length > 0 ? (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                                  <th style={{ paddingBottom: "0.4rem" }}>Ключова дума</th>
                                  <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Кликове</th>
                                  <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Поз.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.gsc.topQueries.map((row) => (
                                  <tr key={row.query} style={{ borderBottom: "1px solid #f8fafc" }}>
                                    <td style={{ padding: "0.4rem 0" }}>{row.query}</td>
                                    <td style={{ padding: "0.4rem 0", textAlign: "right", fontWeight: "700" }}>{formatNumber(row.clicks)}</td>
                                    <td style={{ padding: "0.4rem 0", textAlign: "right" }}>{formatPosition(row.position)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Няма данни за избрания период.</p>
                          )}
                        </div>
                      </div>

                      {previewData.gsc.topPages.length > 0 && (
                        <div style={{ border: "1px solid #f1f5f9", padding: "1.25rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Топ страници</p>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                                <th style={{ paddingBottom: "0.4rem" }}>Страница</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Кликове</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Импресии</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.gsc.topPages.map((row) => (
                                <tr key={row.page} style={{ borderBottom: "1px solid #f8fafc" }}>
                                  <td style={{ padding: "0.4rem 0", wordBreak: "break-all" }}>{row.page}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right", fontWeight: "700" }}>{formatNumber(row.clicks)}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right" }}>{formatNumber(row.impressions)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : null}

                  <SectionSummary noteType="seo" />
                </div>
              )}

              {/* Google Analytics 4 */}
              {reportIsSourceActive("ga4") && previewData.ga4 && (
                <div id="preview-ga4" className="pdf-section" data-pdf-order="4" style={{ pageBreakInside: "avoid", order: 4 }}>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
                    <span style={{ color: reportThemeAccentColor }}>●</span> Google Analytics 4 ({reportGetSourceField("ga4", "externalAccountName") || reportGetSourceField("ga4", "externalAccountId")})
                  </h2>
                  <SectionPeriod />
                  
                  {previewData.errors.ga4 ? (
                    <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.5rem", padding: "1rem", color: "#be123c", marginBottom: "1.5rem" }}>
                      {previewData.errors.ga4}
                    </div>
                  ) : previewData.ga4 ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem", marginBottom: "2rem" }}>
                        {[
                          { label: "Потребители", value: formatNumber(previewData.ga4.kpis.users), delta: previewData.ga4.changes?.users },
                          { label: "Сесии", value: formatNumber(previewData.ga4.kpis.sessions), delta: previewData.ga4.changes?.sessions },
                          { label: "Ангажирани сесии", value: formatNumber(previewData.ga4.kpis.engagedSessions), delta: previewData.ga4.changes?.engagedSessions },
                          { label: `Конверсии (${previewData.ga4.conversionName})`, value: formatNumber(previewData.ga4.kpis.conversions), delta: previewData.ga4.changes?.conversions },
                        ].map(({ label, value, delta }) => (
                          <div key={label} style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>{label}</span>
                            <p style={{ fontSize: "1.6rem", fontWeight: "700", margin: "0.25rem 0 0 0", color: "#0f172a" }}>{value}</p>
                            <ComparisonChange change={delta} />
                          </div>
                        ))}
                      </div>

                      <div style={{ border: "1px solid #f1f5f9", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                        <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Динамика на сесиите за периода</p>
                        <MetricTrendChart
                          accentColor={reportThemeAccentColor}
                          points={previewData.ga4.trend.map((point) => ({ date: point.date, value: point.sessions }))}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
                        <div style={{ border: "1px solid #f1f5f9", padding: "1rem", borderRadius: "0.5rem" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Сесии по основни източници на трафик</p>
                          <AnalyticsChart accentColor={reportThemeAccentColor} channels={previewData.ga4.channels} />
                        </div>

                        <div style={{ border: "1px solid #f1f5f9", padding: "1.25rem", borderRadius: "0.5rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1.25rem 0" }}>Резюме на трафика</p>
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
                            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Няма данни за избрания период.</p>
                          )}
                        </div>
                      </div>

                      {previewData.ga4.landingPages.length > 0 && (
                        <div style={{ border: "1px solid #f1f5f9", padding: "1.25rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Landing Pages</p>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                                <th style={{ paddingBottom: "0.4rem" }}>Страница</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Сесии</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Потребители</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.ga4.landingPages.map((row) => (
                                <tr key={row.page} style={{ borderBottom: "1px solid #f8fafc" }}>
                                  <td style={{ padding: "0.4rem 0", wordBreak: "break-all" }}>{row.page}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right", fontWeight: "700" }}>{formatNumber(row.sessions)}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right" }}>{formatNumber(row.users)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : null}

                  <SectionSummary noteType="traffic" />
                </div>
              )}

              {/* Google Ads is inserted here after its Task 07 data provider is implemented. */}

              {/* Meta Ads */}
              {reportIsSourceActive("meta_ads") && previewData.meta_ads && (
                <div id="preview-meta" className="pdf-section" data-pdf-order="3" style={{ pageBreakInside: "avoid", order: 3 }}>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
                    <span style={{ color: reportThemeAccentColor }}>●</span> Meta (Facebook) Ads ({reportGetSourceField("meta_ads", "externalAccountName")})
                  </h2>
                  <SectionPeriod />

                  {previewData.errors.meta_ads ? (
                    <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.5rem", padding: "1rem", color: "#be123c", marginBottom: "1.5rem" }}>
                      {previewData.errors.meta_ads}
                    </div>
                  ) : previewData.meta_ads ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem", marginBottom: "2rem" }}>
                        {[
                          { label: "Бюджет", value: formatCurrency(previewData.meta_ads.kpis.spend), delta: previewData.meta_ads.changes?.spend },
                          { label: "Импресии", value: formatNumber(previewData.meta_ads.kpis.impressions), delta: previewData.meta_ads.changes?.impressions },
                          { label: "Кликове", value: formatNumber(previewData.meta_ads.kpis.clicks), delta: previewData.meta_ads.changes?.clicks },
                          { label: `Конверсии (${previewData.meta_ads.conversionName})`, value: formatNumber(previewData.meta_ads.kpis.conversions), delta: previewData.meta_ads.changes?.conversions },
                          { label: "Обхват", value: formatNumber(previewData.meta_ads.kpis.reach), delta: previewData.meta_ads.changes?.reach },
                          { label: "CPA", value: formatCurrency(previewData.meta_ads.kpis.cpa), delta: previewData.meta_ads.changes?.cpa, invert: true },
                          { label: "ROAS", value: formatRatio(previewData.meta_ads.kpis.roas), delta: previewData.meta_ads.changes?.roas },
                        ].map(({ label, value, delta, invert }) => (
                          <div key={label} style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>{label}</span>
                            <p style={{ fontSize: "1.45rem", fontWeight: "700", margin: "0.25rem 0 0 0", color: "#0f172a" }}>{value}</p>
                            <ComparisonChange change={delta} invert={invert} />
                          </div>
                        ))}
                      </div>
                      <div style={{ border: "1px solid #f1f5f9", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                        <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Динамика на бюджета за периода</p>
                        <MetricTrendChart
                          accentColor={reportThemeAccentColor}
                          points={previewData.meta_ads.trend.map((point) => ({ date: point.date, value: point.spend }))}
                        />
                      </div>
                      {previewData.meta_ads.campaigns.length > 0 && (
                        <div style={{ border: "1px solid #f1f5f9", padding: "1.25rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                          <p style={{ fontSize: "0.85rem", fontWeight: "700", margin: "0 0 1rem 0" }}>Кампании</p>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                                <th style={{ paddingBottom: "0.4rem" }}>Кампания</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Бюджет</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>Конв.</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>CPA</th>
                                <th style={{ paddingBottom: "0.4rem", textAlign: "right" }}>ROAS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.meta_ads.campaigns.map((row) => (
                                <tr key={row.campaign} style={{ borderBottom: "1px solid #f8fafc" }}>
                                  <td style={{ padding: "0.4rem 0" }}>{row.campaign}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right", fontWeight: "700" }}>{formatCurrency(row.spend)}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right" }}>{formatNumber(row.conversions)}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right" }}>{formatCurrency(row.cpa)}</td>
                                  <td style={{ padding: "0.4rem 0", textAlign: "right" }}>{formatRatio(row.roas)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : null}

                  <SectionSummary noteType="meta_ads" />
                </div>
              )}

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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass" style={{ padding: "2.5rem", borderRadius: "1rem", maxWidth: "420px", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ fontSize: "1.4rem", fontWeight: "700", marginBottom: "1rem" }}>Изтриване на проект</h3>
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.95rem", marginBottom: "2rem" }}>
              Сигурни ли сте, че искате да изтриете проекта <strong>{projectName}</strong>? Това действие е необратимо.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button className="secondary" onClick={() => setIsDeleting(false)}>
                Отказ
              </button>
              <button className="primary" style={{ background: "#ef4444" }} onClick={handleDelete}>
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
