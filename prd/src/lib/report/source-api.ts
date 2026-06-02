import type { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  fetchReportSourceData,
  providerForSource,
  sourceFeedback,
  type Period,
  type ReportSourceInput,
  type SourceType,
} from "@/lib/report/data";
import { reportLogger } from "@/lib/report/logger";

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface SourceApiBody {
  projectId?: string;
  externalAccountId?: string;
  oauthConnectionId?: string | null;
  primaryConversion?: string | null;
  reportingStart?: string;
  reportingEnd?: string;
  comparisonStart?: string | null;
  comparisonEnd?: string | null;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function parsePeriods(body: SourceApiBody) {
  if (!body.reportingStart || !body.reportingEnd) {
    throw new ApiError("Липсва период на отчитане.", 400);
  }
  const today = getTodayIsoDate();
  if (body.reportingStart > today || body.reportingEnd > today) {
    throw new ApiError("Периодът на отчитане не може да бъде в бъдеще.", 400);
  }
  if (body.reportingStart > body.reportingEnd) {
    throw new ApiError("Невалиден период на отчитане.", 400);
  }
  if (!!body.comparisonStart !== !!body.comparisonEnd) {
    throw new ApiError("Сравнителният период трябва да има начална и крайна дата.", 400);
  }
  if (body.comparisonStart && body.comparisonEnd && body.comparisonStart > body.comparisonEnd) {
    throw new ApiError("Невалиден сравнителен период.", 400);
  }
  if ((body.comparisonStart && body.comparisonStart > today) || (body.comparisonEnd && body.comparisonEnd > today)) {
    throw new ApiError("Сравнителният период не може да бъде в бъдеще.", 400);
  }

  return {
    period: { startDate: body.reportingStart, endDate: body.reportingEnd },
    comparison: body.comparisonStart && body.comparisonEnd
      ? { startDate: body.comparisonStart, endDate: body.comparisonEnd }
      : undefined,
  };
}

export async function resolveReportSourceRequest(
  prisma: PrismaClient,
  userId: string,
  sourceType: SourceType,
  body: SourceApiBody
) {
  if (!body.projectId) {
    throw new ApiError("Липсва проект.", 400);
  }
  if (!body.externalAccountId) {
    throw new ApiError("Липсва акаунт за източника.", 400);
  }
  if (["ga4", "google_ads", "meta_ads"].includes(sourceType) && !body.primaryConversion) {
    throw new ApiError(`Липсва основна конверсия за ${sourceType}.`, 400);
  }

  const project = await prisma.project.findFirst({
    where: { id: body.projectId, userId },
    include: { projectSources: true },
  });
  if (!project) {
    throw new ApiError("Проектът не е намерен.", 404);
  }

  const provider = providerForSource(sourceType);
  if (body.oauthConnectionId) {
    const connection = await prisma.oAuthConnection.findFirst({
      where: {
        id: body.oauthConnectionId,
        userId,
        provider,
        connectionStatus: "active",
      },
      select: { id: true },
    });
    if (!connection) {
      throw new ApiError("Избраната интеграция не е достъпна за този профил.", 403);
    }
  }

  const savedSource = project.projectSources.find(
    (source) => source.sourceType === sourceType && source.externalAccountId === body.externalAccountId
  );

  const source: ReportSourceInput = {
    sourceType,
    externalAccountId: body.externalAccountId,
    oauthConnectionId: savedSource?.oauthConnectionId ?? body.oauthConnectionId ?? null,
    primaryConversion: body.primaryConversion ?? savedSource?.primaryConversion ?? null,
    isEnabled: true,
  };

  const { period, comparison } = parsePeriods(body);
  return { source, period, comparison };
}

export function createReportSourceHandler(prisma: PrismaClient, sourceType: SourceType) {
  return async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
    }

    const userId = (session.user as any).id as string;

    try {
      const body = (await req.json()) as SourceApiBody;
      const { source, period, comparison } = await resolveReportSourceRequest(prisma, userId, sourceType, body);

      reportLogger.debug("Internal report source request", { sourceType });
      const data = await fetchReportSourceData(prisma, userId, source, period as Period, comparison as Period | undefined);

      return NextResponse.json(data);
    } catch (error: any) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      reportLogger.warn("Internal report source request failed", { sourceType });
      return NextResponse.json({ error: sourceFeedback(sourceType, error.message) }, { status: 400 });
    }
  };
}
