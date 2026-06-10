import type { PrismaClient } from "@prisma/client";
import { fetchWithRetry } from "@/lib/integrations/http";
import { getProviderAccessToken } from "@/lib/integrations/tokens";
import {
  calculateCpa,
  calculateCtr,
  calculateMetricChange,
  calculateRoas,
} from "@/lib/report/metrics";
import type { PreviewSourceType } from "@/lib/report/sections";

export type SourceType = PreviewSourceType;

export interface ReportSourceInput {
  sourceType: SourceType;
  externalAccountId: string;
  oauthConnectionId?: string | null;
  primaryConversion?: string | null;
  isEnabled?: boolean;
}

export interface Period {
  startDate: string;
  endDate: string;
}

interface SearchAnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface Ga4Row {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}

interface GoogleAdsMetrics {
  costMicros?: string | number;
  clicks?: string | number;
  impressions?: string | number;
  conversions?: string | number;
  conversionsValue?: string | number;
}

interface GoogleAdsRow {
  campaign?: {
    id?: string;
    name?: string;
  };
  segments?: {
    date?: string;
    conversionActionName?: string;
  };
  metrics?: GoogleAdsMetrics;
}

interface MetaAction {
  action_type: string;
  value: string;
}

interface MetaInsight {
  date_start?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}

export function providerForSource(sourceType: SourceType) {
  return sourceType === "meta_ads" ? "meta" : "google";
}

export function sourceFeedback(sourceType: SourceType, message?: string) {
  const labels: Record<SourceType, string> = {
    gsc: "Google Search Console",
    ga4: "Google Analytics 4",
    google_ads: "Google Ads",
    meta_ads: "Meta Ads",
  };
  if (message?.includes("отне твърде много време")) {
    return `Зареждането от ${labels[sourceType]} отне твърде много време. Опитайте отново.`;
  }
  if (sourceType === "google_ads" && message && /GOOGLE_ADS|Developer Token|Google Ads API|insufficient authentication scopes|permission/i.test(message)) {
    return message;
  }
  if (message && /връзката|интеграция|Свържете/.test(message)) return message;

  return `Данните от ${labels[sourceType]} не могат да бъдат заредени в момента. Проверете връзката и опитайте отново.`;
}

async function queryGsc(
  token: string,
  siteUrl: string,
  period: Period,
  dimensions: string[],
  rowLimit: number
) {
  const response = await fetchWithRetry(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...period, dimensions, rowLimit, type: "web" }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Неуспешно извличане на Search Console данни.");
  }
  return (data.rows ?? []) as SearchAnalyticsRow[];
}

async function fetchGscKpis(token: string, siteUrl: string, period: Period) {
  const total = (await queryGsc(token, siteUrl, period, [], 1))[0] ?? {};
  const clicks = total.clicks ?? 0;
  const impressions = total.impressions ?? 0;

  return {
    clicks,
    impressions,
    ctr: calculateCtr(clicks, impressions),
    position: total.position ?? 0,
  };
}

export async function fetchGscData(token: string, source: ReportSourceInput, period: Period, comparison?: Period) {
  const [current, trend, queryRows, pageRows, previous] = await Promise.all([
    fetchGscKpis(token, source.externalAccountId, period),
    queryGsc(token, source.externalAccountId, period, ["date"], 500),
    queryGsc(token, source.externalAccountId, period, ["query"], 20),
    queryGsc(token, source.externalAccountId, period, ["page"], 10),
    comparison ? fetchGscKpis(token, source.externalAccountId, comparison) : Promise.resolve(undefined),
  ]);

  return {
    kpis: current,
    changes: previous
      ? {
          clicks: calculateMetricChange(current.clicks, previous.clicks),
          impressions: calculateMetricChange(current.impressions, previous.impressions),
          ctr: calculateMetricChange(current.ctr, previous.ctr),
          position: calculateMetricChange(current.position, previous.position),
        }
      : undefined,
    trend: trend.map((row) => ({ date: row.keys?.[0] ?? "", clicks: row.clicks ?? 0 })),
    topQueries: queryRows.map((row) => ({
      query: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      position: row.position ?? 0,
    })),
    topPages: pageRows.map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
    })),
  };
}

async function runGa4Report(token: string, propertyId: string, body: object) {
  const response = await fetchWithRetry(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Неуспешно извличане на Google Analytics данни.");
  }
  return data;
}

async function fetchGa4Kpis(token: string, source: ReportSourceInput, period: Period) {
  const dateRanges = [period];
  const [totals, conversion] = await Promise.all([
    runGa4Report(token, source.externalAccountId, {
      dateRanges,
      metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "engagedSessions" }],
    }),
    runGa4Report(token, source.externalAccountId, {
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { value: source.primaryConversion } } },
    }),
  ]);
  const metrics = ((totals.rows ?? [])[0] as Ga4Row | undefined)?.metricValues ?? [];
  const conversionMetrics = ((conversion.rows ?? [])[0] as Ga4Row | undefined)?.metricValues ?? [];

  return {
    users: Number(metrics[0]?.value ?? 0),
    sessions: Number(metrics[1]?.value ?? 0),
    engagedSessions: Number(metrics[2]?.value ?? 0),
    conversions: Number(conversionMetrics[0]?.value ?? 0),
  };
}

export async function fetchGa4Data(token: string, source: ReportSourceInput, period: Period, comparison?: Period) {
  const [current, previous, trend, channels, landingPages] = await Promise.all([
    fetchGa4Kpis(token, source, period),
    comparison ? fetchGa4Kpis(token, source, comparison) : Promise.resolve(undefined),
    runGa4Report(token, source.externalAccountId, {
      dateRanges: [period],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    runGa4Report(token, source.externalAccountId, {
      dateRanges: [period],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    runGa4Report(token, source.externalAccountId, {
      dateRanges: [period],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
  ]);

  return {
    conversionName: source.primaryConversion!,
    kpis: current,
    changes: previous
      ? {
          users: calculateMetricChange(current.users, previous.users),
          sessions: calculateMetricChange(current.sessions, previous.sessions),
          engagedSessions: calculateMetricChange(current.engagedSessions, previous.engagedSessions),
          conversions: calculateMetricChange(current.conversions, previous.conversions),
        }
      : undefined,
    trend: ((trend.rows ?? []) as Ga4Row[]).map((row) => ({
      date: row.dimensionValues?.[0]?.value ?? "",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    })),
    channels: ((channels.rows ?? []) as Ga4Row[]).map((row) => ({
      channel: row.dimensionValues?.[0]?.value ?? "Други",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    })),
    landingPages: ((landingPages.rows ?? []) as Ga4Row[]).map((row) => ({
      page: row.dimensionValues?.[0]?.value ?? "",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0),
    })),
  };
}

function toGoogleAdsNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function microsToCurrency(value: string | number | undefined) {
  return toGoogleAdsNumber(value) / 1_000_000;
}

function normalizeCustomerId(customerId: string) {
  const normalized = customerId.replace(/^customers\//, "").replace(/\D/g, "");
  if (!normalized) {
    throw new Error("Невалиден Google Ads Customer ID.");
  }
  return normalized;
}

function cleanEnvValue(value: string | undefined) {
  return value?.trim();
}

function escapeGaqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getGoogleAdsConfig() {
  const developerToken = cleanEnvValue(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  if (!developerToken) {
    throw new Error("Липсва GOOGLE_ADS_DEVELOPER_TOKEN. Добавете Google Ads Developer Token в .env.local и рестартирайте dev server-а.");
  }

  return {
    apiVersion: cleanEnvValue(process.env.GOOGLE_ADS_API_VERSION) || "v22",
    developerToken,
    loginCustomerId: cleanEnvValue(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
      ? normalizeCustomerId(cleanEnvValue(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)!)
      : undefined,
  };
}

async function searchGoogleAds(token: string, customerId: string, query: string) {
  const config = getGoogleAdsConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "developer-token": config.developerToken,
  };

  if (config.loginCustomerId) {
    headers["login-customer-id"] = config.loginCustomerId;
  }

  const response = await fetchWithRetry(
    `https://googleads.googleapis.com/${config.apiVersion}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    },
    15000
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Неуспешно извличане на Google Ads данни.");
  }

  const chunks = Array.isArray(data) ? data : [data];
  return chunks.flatMap((chunk) => (chunk.results ?? []) as GoogleAdsRow[]);
}

function periodCondition(period: Period) {
  return `segments.date BETWEEN '${period.startDate}' AND '${period.endDate}'`;
}

function aggregateGoogleAdsRows(rows: GoogleAdsRow[]) {
  return rows.reduce(
    (total, row) => {
      const metrics = row.metrics ?? {};
      total.spend += microsToCurrency(metrics.costMicros);
      total.clicks += toGoogleAdsNumber(metrics.clicks);
      total.impressions += toGoogleAdsNumber(metrics.impressions);
      total.conversions += toGoogleAdsNumber(metrics.conversions);
      total.value += toGoogleAdsNumber(metrics.conversionsValue);
      return total;
    },
    { spend: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 }
  );
}

async function fetchGoogleAdsTrafficRows(token: string, customerId: string, period: Period) {
  return searchGoogleAds(token, customerId, `
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM customer
    WHERE ${periodCondition(period)}
    ORDER BY segments.date
  `);
}

async function fetchGoogleAdsConversionRows(token: string, customerId: string, period: Period, conversionName: string) {
  return searchGoogleAds(token, customerId, `
    SELECT
      segments.date,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE ${periodCondition(period)}
      AND segments.conversion_action_name = '${escapeGaqlString(conversionName)}'
    ORDER BY segments.date
  `);
}

async function fetchGoogleAdsCampaignTrafficRows(token: string, customerId: string, period: Period) {
  return searchGoogleAds(token, customerId, `
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM campaign
    WHERE ${periodCondition(period)}
    ORDER BY metrics.cost_micros DESC
    LIMIT 20
  `);
}

async function fetchGoogleAdsCampaignConversionRows(token: string, customerId: string, period: Period, conversionName: string) {
  return searchGoogleAds(token, customerId, `
    SELECT
      campaign.id,
      campaign.name,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE ${periodCondition(period)}
      AND segments.conversion_action_name = '${escapeGaqlString(conversionName)}'
    LIMIT 200
  `);
}

async function fetchGoogleAdsKpis(token: string, customerId: string, source: ReportSourceInput, period: Period) {
  const [trafficRows, conversionRows] = await Promise.all([
    fetchGoogleAdsTrafficRows(token, customerId, period),
    fetchGoogleAdsConversionRows(token, customerId, period, source.primaryConversion!),
  ]);

  const traffic = aggregateGoogleAdsRows(trafficRows);
  const conversion = aggregateGoogleAdsRows(conversionRows);

  return {
    spend: traffic.spend,
    clicks: traffic.clicks,
    impressions: traffic.impressions,
    cpc: traffic.clicks > 0 ? traffic.spend / traffic.clicks : 0,
    conversions: conversion.conversions,
    cpa: calculateCpa(traffic.spend, conversion.conversions),
    roas: calculateRoas(conversion.value, traffic.spend),
  };
}

export async function fetchGoogleAdsData(token: string, source: ReportSourceInput, period: Period, comparison?: Period) {
  const customerId = normalizeCustomerId(source.externalAccountId);
  const [current, previous, trendRows, campaignTrafficRows, campaignConversionRows] = await Promise.all([
    fetchGoogleAdsKpis(token, customerId, source, period),
    comparison ? fetchGoogleAdsKpis(token, customerId, source, comparison) : Promise.resolve(undefined),
    fetchGoogleAdsTrafficRows(token, customerId, period),
    fetchGoogleAdsCampaignTrafficRows(token, customerId, period),
    fetchGoogleAdsCampaignConversionRows(token, customerId, period, source.primaryConversion!),
  ]);

  const conversionsByCampaign = new Map<string, { conversions: number; value: number }>();
  campaignConversionRows.forEach((row) => {
    const id = row.campaign?.id ?? row.campaign?.name ?? "";
    const previousValue = conversionsByCampaign.get(id) ?? { conversions: 0, value: 0 };
    conversionsByCampaign.set(id, {
      conversions: previousValue.conversions + toGoogleAdsNumber(row.metrics?.conversions),
      value: previousValue.value + toGoogleAdsNumber(row.metrics?.conversionsValue),
    });
  });

  return {
    conversionName: source.primaryConversion!,
    kpis: current,
    changes: previous
      ? {
          spend: calculateMetricChange(current.spend, previous.spend),
          clicks: calculateMetricChange(current.clicks, previous.clicks),
          impressions: calculateMetricChange(current.impressions, previous.impressions),
          cpc: calculateMetricChange(current.cpc, previous.cpc),
          conversions: calculateMetricChange(current.conversions, previous.conversions),
          cpa: calculateMetricChange(current.cpa, previous.cpa),
          roas: calculateMetricChange(current.roas, previous.roas),
        }
      : undefined,
    trend: trendRows.map((row) => ({
      date: row.segments?.date ?? "",
      spend: microsToCurrency(row.metrics?.costMicros),
    })),
    campaigns: campaignTrafficRows.map((row) => {
      const spend = microsToCurrency(row.metrics?.costMicros);
      const id = row.campaign?.id ?? row.campaign?.name ?? "";
      const conversion = conversionsByCampaign.get(id) ?? { conversions: 0, value: 0 };

      return {
        campaign: row.campaign?.name ?? "",
        spend,
        clicks: toGoogleAdsNumber(row.metrics?.clicks),
        impressions: toGoogleAdsNumber(row.metrics?.impressions),
        conversions: conversion.conversions,
        cpa: calculateCpa(spend, conversion.conversions),
        roas: calculateRoas(conversion.value, spend),
      };
    }),
  };
}

function getMetaValue(actions: MetaAction[] | undefined, actionType: string) {
  return Number(actions?.find((action) => action.action_type === actionType)?.value ?? 0);
}

async function fetchMetaInsights(token: string, accountId: string, period: Period, fields: string, params: Record<string, string>) {
  const query = new URLSearchParams({
    fields,
    time_range: JSON.stringify({ since: period.startDate, until: period.endDate }),
    ...params,
  });
  const response = await fetchWithRetry(`https://graph.facebook.com/v19.0/${accountId}/insights?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Неуспешно извличане на Meta Ads данни.");
  }
  return (data.data ?? []) as MetaInsight[];
}

async function fetchMetaKpis(token: string, source: ReportSourceInput, period: Period) {
  const row = (await fetchMetaInsights(
    token,
    source.externalAccountId,
    period,
    "spend,impressions,reach,clicks,actions,action_values",
    { level: "account" }
  ))[0] ?? {};
  const spend = Number(row.spend ?? 0);
  const conversions = getMetaValue(row.actions, source.primaryConversion!);
  const value = getMetaValue(row.action_values, source.primaryConversion!);

  return {
    spend,
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions,
    cpa: calculateCpa(spend, conversions),
    roas: calculateRoas(value, spend),
  };
}

export async function fetchMetaData(token: string, source: ReportSourceInput, period: Period, comparison?: Period) {
  const [current, previous, trend, campaigns] = await Promise.all([
    fetchMetaKpis(token, source, period),
    comparison ? fetchMetaKpis(token, source, comparison) : Promise.resolve(undefined),
    fetchMetaInsights(token, source.externalAccountId, period, "spend", { level: "account", time_increment: "1" }),
    fetchMetaInsights(
      token,
      source.externalAccountId,
      period,
      "campaign_name,spend,clicks,impressions,actions,action_values",
      { level: "campaign", limit: "20" }
    ),
  ]);

  return {
    conversionName: source.primaryConversion!,
    kpis: current,
    changes: previous
      ? {
          spend: calculateMetricChange(current.spend, previous.spend),
          impressions: calculateMetricChange(current.impressions, previous.impressions),
          reach: calculateMetricChange(current.reach, previous.reach),
          clicks: calculateMetricChange(current.clicks, previous.clicks),
          conversions: calculateMetricChange(current.conversions, previous.conversions),
          cpa: calculateMetricChange(current.cpa, previous.cpa),
          roas: calculateMetricChange(current.roas, previous.roas),
        }
      : undefined,
    trend: trend.map((row) => ({ date: row.date_start ?? "", spend: Number(row.spend ?? 0) })),
    campaigns: campaigns
      .map((row) => {
        const spend = Number(row.spend ?? 0);
        const conversions = getMetaValue(row.actions, source.primaryConversion!);
        const value = getMetaValue(row.action_values, source.primaryConversion!);
        return {
          campaign: row.campaign_name ?? "",
          spend,
          clicks: Number(row.clicks ?? 0),
          conversions,
          cpa: calculateCpa(spend, conversions),
          roas: calculateRoas(value, spend),
        };
      })
      .sort((a, b) => b.spend - a.spend),
  };
}

export async function fetchReportSourceData(
  prisma: PrismaClient,
  userId: string,
  source: ReportSourceInput,
  period: Period,
  comparison?: Period
) {
  const provider = providerForSource(source.sourceType);
  const token = await getProviderAccessToken(prisma, userId, provider);

  if (source.sourceType === "gsc") return fetchGscData(token, source, period, comparison);
  if (source.sourceType === "ga4") return fetchGa4Data(token, source, period, comparison);
  if (source.sourceType === "google_ads") return fetchGoogleAdsData(token, source, period, comparison);
  return fetchMetaData(token, source, period, comparison);
}
