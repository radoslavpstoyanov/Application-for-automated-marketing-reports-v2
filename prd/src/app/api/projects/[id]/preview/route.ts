import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { fetchReportSourceData, sourceFeedback, type ReportSourceInput, type SourceType } from "@/lib/report/data";
import { reportLogger } from "@/lib/report/logger";
import { ApiError, parsePeriods, resolveReportSourceRequest, type SourceApiBody } from "@/lib/report/source-api";

const prisma = new PrismaClient();

interface PreviewInput {
  reportingStart?: string;
  reportingEnd?: string;
  comparisonStart?: string | null;
  comparisonEnd?: string | null;
  sources?: ReportSourceInput[];
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id as string;
  const project = await prisma.project.findFirst({ where: { id, userId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Проектът не е намерен." }, { status: 404 });
  }

  const body = (await req.json()) as PreviewInput;
  let periodData: ReturnType<typeof parsePeriods>;
  try {
    periodData = parsePeriods({
      projectId: id,
      reportingStart: body.reportingStart,
      reportingEnd: body.reportingEnd,
      comparisonStart: body.comparisonStart,
      comparisonEnd: body.comparisonEnd,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const sources = (body.sources ?? []).filter((source) => source.isEnabled);
  if (sources.length === 0) {
    return NextResponse.json({ error: "Активирайте поне един източник на данни." }, { status: 400 });
  }

  const result: Record<string, unknown> & { errors: Partial<Record<SourceType, string>> } = { errors: {} };

  await Promise.all(sources.map(async (inputSource) => {
    const sourceType = inputSource.sourceType;
    reportLogger.debug("Loading report source", { sourceType });

    try {
      const sourceBody: SourceApiBody = {
        projectId: id,
        externalAccountId: inputSource.externalAccountId,
        oauthConnectionId: inputSource.oauthConnectionId ?? null,
        primaryConversion: inputSource.primaryConversion ?? null,
        reportingStart: body.reportingStart,
        reportingEnd: body.reportingEnd,
        comparisonStart: body.comparisonStart,
        comparisonEnd: body.comparisonEnd,
      };
      const { source } = await resolveReportSourceRequest(prisma, userId, sourceType, sourceBody);
      const data = await fetchReportSourceData(prisma, userId, source, periodData.period, periodData.comparison);

      if (sourceType === "gsc") result.gsc = data;
      if (sourceType === "ga4") result.ga4 = data;
      if (sourceType === "google_ads") result.google_ads = data;
      if (sourceType === "meta_ads") result.meta_ads = data;
      reportLogger.debug("Report source processed", { sourceType });
    } catch (error: any) {
      const statusMessage = error instanceof ApiError ? error.message : error.message;
      result.errors[sourceType] = sourceFeedback(sourceType, statusMessage);
      reportLogger.warn("Report source failed", { sourceType });
    }
  }));

  return NextResponse.json(result);
}
