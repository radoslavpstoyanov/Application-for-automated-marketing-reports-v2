import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

type SourceType = "gsc" | "ga4" | "google_ads" | "meta_ads";

interface SourceInput {
  sourceType: SourceType;
  externalAccountId: string;
  primaryConversion?: string | null;
  isEnabled: boolean;
}

interface PreviewInput {
  reportingStart?: string;
  reportingEnd?: string;
  comparisonStart?: string;
  comparisonEnd?: string;
  sources?: SourceInput[];
}

interface Period {
  startDate: string;
  endDate: string;
}

interface MetricChange {
  absolute: number;
  percent: number | null;
}

function sourceFeedback(sourceType: SourceType, message?: string) {
  const labels: Record<SourceType, string> = {
    gsc: "Google Search Console",
    ga4: "Google Analytics 4",
    google_ads: "Google Ads",
    meta_ads: "Meta Ads",
  };
  if (message?.includes("отне твърде много време")) {
    return `Зареждането от ${labels[sourceType]} отне твърде много време. Опитайте отново.`;
  }
  if (message && /връзката|интеграция|Свържете/.test(message)) return message;

  return `Данните от ${labels[sourceType]} не могат да бъдат заредени в момента. Проверете връзката и опитайте отново.`;
}

async function fetchWithRetry(url: string, init?: RequestInit, timeoutMs = 8000) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      return response;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error("Заявката отне твърде много време.");
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Неуспешно извличане на данни.");
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

function change(current: number, previous?: number): MetricChange | undefined {
  if (previous === undefined) return undefined;
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : (current - previous) / previous,
  };
}

async function getProviderToken(userId: string, provider: "google" | "meta") {
  const connection = await prisma.oAuthConnection.findFirst({
    where: { userId, provider, connectionStatus: "active" },
  });

  if (!connection) {
    throw new Error(`Няма активна ${provider === "google" ? "Google" : "Meta"} интеграция.`);
  }

  if (provider === "meta") {
    if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      await prisma.oAuthConnection.update({
        where: { id: connection.id },
        data: { connectionStatus: "expired" },
      });
      throw new Error("Meta връзката е изтекла. Свържете акаунта отново.");
    }
    return connection.accessToken;
  }

  if (!connection.tokenExpiresAt || connection.tokenExpiresAt >= new Date()) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    throw new Error("Google връзката е изтекла. Свържете акаунта отново.");
  }

  const tokenRes = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    await prisma.oAuthConnection.update({
      where: { id: connection.id },
      data: { connectionStatus: "expired" },
    });
    throw new Error("Google връзката е изтекла. Свържете акаунта отново.");
  }

  await prisma.oAuthConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: tokenData.access_token,
      tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
    },
  });

  return tokenData.access_token as string;
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
  return {
    clicks: total.clicks ?? 0,
    impressions: total.impressions ?? 0,
    ctr: total.ctr ?? 0,
    position: total.position ?? 0,
  };
}

async function fetchGscData(token: string, source: SourceInput, period: Period, comparison?: Period) {
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
          clicks: change(current.clicks, previous.clicks),
          impressions: change(current.impressions, previous.impressions),
          ctr: change(current.ctr, previous.ctr),
          position: change(current.position, previous.position),
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

async function fetchGa4Kpis(token: string, source: SourceInput, period: Period) {
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

async function fetchGa4Data(token: string, source: SourceInput, period: Period, comparison?: Period) {
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
          users: change(current.users, previous.users),
          sessions: change(current.sessions, previous.sessions),
          engagedSessions: change(current.engagedSessions, previous.engagedSessions),
          conversions: change(current.conversions, previous.conversions),
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

async function fetchMetaKpis(token: string, source: SourceInput, period: Period) {
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
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? value / spend : 0,
  };
}

async function fetchMetaData(token: string, source: SourceInput, period: Period, comparison?: Period) {
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
          spend: change(current.spend, previous.spend),
          impressions: change(current.impressions, previous.impressions),
          reach: change(current.reach, previous.reach),
          clicks: change(current.clicks, previous.clicks),
          conversions: change(current.conversions, previous.conversions),
          cpa: change(current.cpa, previous.cpa),
          roas: change(current.roas, previous.roas),
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
          cpa: conversions > 0 ? spend / conversions : 0,
          roas: spend > 0 ? value / spend : 0,
        };
      })
      .sort((a, b) => b.spend - a.spend),
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any).id as string;
  const project = await prisma.project.findFirst({ where: { id, userId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Проектът не е намерен." }, { status: 404 });

  const body = (await req.json()) as PreviewInput;
  if (!body.reportingStart || !body.reportingEnd) {
    return NextResponse.json({ error: "Липсва период на отчитане." }, { status: 400 });
  }
  if (body.reportingStart > body.reportingEnd) {
    return NextResponse.json({ error: "Невалиден период на отчитане." }, { status: 400 });
  }
  if (!!body.comparisonStart !== !!body.comparisonEnd) {
    return NextResponse.json({ error: "Сравнителният период трябва да има начална и крайна дата." }, { status: 400 });
  }
  if (body.comparisonStart && body.comparisonEnd && body.comparisonStart > body.comparisonEnd) {
    return NextResponse.json({ error: "Невалиден сравнителен период." }, { status: 400 });
  }

  const sources = (body.sources ?? []).filter((source) => source.isEnabled);
  if (sources.length === 0) {
    return NextResponse.json({ error: "Активирайте поне един източник на данни." }, { status: 400 });
  }
  const unconfiguredSource = sources.find((source) => !source.externalAccountId);
  if (unconfiguredSource) {
    return NextResponse.json({ error: "Моля, изберете акаунт за всеки активен източник." }, { status: 400 });
  }
  const conversionSource = sources.find(
    (source) => ["ga4", "google_ads", "meta_ads"].includes(source.sourceType) && !source.primaryConversion
  );
  if (conversionSource) {
    return NextResponse.json({ error: `Липсва основна конверсия за ${conversionSource.sourceType}.` }, { status: 400 });
  }

  const period = { startDate: body.reportingStart, endDate: body.reportingEnd };
  const comparison = body.comparisonStart && body.comparisonEnd
    ? { startDate: body.comparisonStart, endDate: body.comparisonEnd }
    : undefined;
  const result: Record<string, unknown> & { errors: Partial<Record<SourceType, string>> } = { errors: {} };
  let googleToken: string | undefined;
  let metaToken: string | undefined;

  await Promise.all(sources.map(async (source) => {
    try {
      if (source.sourceType === "gsc" || source.sourceType === "ga4") {
        googleToken ??= await getProviderToken(userId, "google");
        if (source.sourceType === "gsc") result.gsc = await fetchGscData(googleToken, source, period, comparison);
        if (source.sourceType === "ga4") result.ga4 = await fetchGa4Data(googleToken, source, period, comparison);
      } else if (source.sourceType === "meta_ads") {
        metaToken ??= await getProviderToken(userId, "meta");
        result.meta_ads = await fetchMetaData(metaToken, source, period, comparison);
      } else if (source.sourceType === "google_ads") {
        result.errors.google_ads = "Google Ads все още не е настроен за извличане на данни.";
      }
    } catch (error: any) {
      result.errors[source.sourceType] = sourceFeedback(source.sourceType, error.message);
    }
  }));

  return NextResponse.json(result);
}
