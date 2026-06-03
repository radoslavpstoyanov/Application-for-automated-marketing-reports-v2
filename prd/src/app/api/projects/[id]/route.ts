import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();
const SOURCE_PROVIDERS: Record<string, string> = {
  gsc: "google",
  ga4: "google",
  google_ads: "google",
  meta_ads: "meta",
};

interface SourceInput {
  sourceType: string;
  oauthConnectionId?: string | null;
  externalAccountId: string;
  externalAccountName?: string;
  primaryConversion?: string | null;
  isEnabled: boolean;
}

interface NoteInput {
  noteType: string;
  noteText: string;
}

interface ProjectPatchProps {
  params: Promise<{ id: string }>;
}

function getTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const partByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${partByType.get("year")}-${partByType.get("month")}-${partByType.get("day")}`;
}

function validateOptionalDateRange(start: unknown, end: unknown, label: string) {
  const startDate = typeof start === "string" ? start : "";
  const endDate = typeof end === "string" ? end : "";
  const today = getTodayIsoDate();

  if ((startDate && startDate > today) || (endDate && endDate > today)) {
    return `${label} не може да бъде в бъдеще.`;
  }
  if (startDate && endDate && startDate > endDate) {
    return `Невалиден ${label.toLowerCase()}.`;
  }
  return null;
}

export async function PATCH(req: Request, { params }: ProjectPatchProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const userId = (session.user as any).id;

    // Verify ownership of the project
    const existingProject = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Проектът не е намерен." }, { status: 404 });
    }

    const {
      projectName,
      selectedTheme,
      reportLanguage,
      reportingPeriodStart,
      reportingPeriodEnd,
      comparisonPeriodStart,
      comparisonPeriodEnd,
      pdfTitle,
      clientLogoUrl,
      sources,
      notes,
    } = body;

    const reportingPeriodError = validateOptionalDateRange(reportingPeriodStart, reportingPeriodEnd, "Периодът на отчитане");
    if (reportingPeriodError) {
      return NextResponse.json({ error: reportingPeriodError }, { status: 400 });
    }
    const comparisonPeriodError = validateOptionalDateRange(comparisonPeriodStart, comparisonPeriodEnd, "Сравнителният период");
    if (comparisonPeriodError) {
      return NextResponse.json({ error: comparisonPeriodError }, { status: 400 });
    }

    const sourceInputs = Array.isArray(sources)
      ? (sources as SourceInput[])
          .map((src) => ({
            ...src,
            sourceType: typeof src.sourceType === "string" ? src.sourceType : "",
            oauthConnectionId: src.oauthConnectionId === "sandbox" ? null : (src.oauthConnectionId || null),
            externalAccountId: typeof src.externalAccountId === "string" ? src.externalAccountId.trim() : "",
            externalAccountName: typeof src.externalAccountName === "string" ? src.externalAccountName.trim() : "",
            primaryConversion: typeof src.primaryConversion === "string" ? src.primaryConversion.trim() || null : null,
            isEnabled: !!src.isEnabled,
          }))
          .filter((src) => src.isEnabled || !!src.externalAccountId || !!src.externalAccountName || !!src.primaryConversion)
      : null;
    const invalidSource = sourceInputs?.find((src) => !SOURCE_PROVIDERS[src.sourceType]);
    if (invalidSource) {
      return NextResponse.json({ error: "Избраният източник на данни не се поддържа." }, { status: 400 });
    }
    const sourceConnectionIds = sourceInputs
      ? [...new Set(sourceInputs.map((src) => src.oauthConnectionId).filter((value): value is string => !!value))]
      : [];

    if (sourceConnectionIds.length > 0) {
      const ownedConnections = await prisma.oAuthConnection.findMany({
        where: {
          id: { in: sourceConnectionIds },
          userId,
        },
        select: { id: true, provider: true },
      });

      if (ownedConnections.length !== sourceConnectionIds.length) {
        return NextResponse.json({ error: "Избраната интеграция не е достъпна за този профил." }, { status: 400 });
      }

      const providerByConnection = new Map(ownedConnections.map((connection) => [connection.id, connection.provider]));
      const providerMismatch = sourceInputs?.some((src) => (
        src.oauthConnectionId && providerByConnection.get(src.oauthConnectionId) !== SOURCE_PROVIDERS[src.sourceType]
      ));
      if (providerMismatch) {
        return NextResponse.json({ error: "Избраната интеграция не отговаря на източника на данни." }, { status: 400 });
      }
    }
    const incompleteEnabledSource = sourceInputs?.find((src) => src.isEnabled && !src.externalAccountId);
    if (incompleteEnabledSource) {
      return NextResponse.json({ error: "Активиран източник на данни няма избран акаунт." }, { status: 400 });
    }
    const missingConversionSource = sourceInputs?.find((src) => (
      src.isEnabled && ["ga4", "google_ads", "meta_ads"].includes(src.sourceType) && !src.primaryConversion
    ));
    if (missingConversionSource) {
      return NextResponse.json({ error: "Активиран рекламен/аналитичен източник няма избрана основна конверсия." }, { status: 400 });
    }

    // Use a transaction to update project configuration and its children atomically
    await prisma.$transaction(async (tx) => {
      // 1. Update Project basic fields
      await tx.project.update({
        where: { id },
        data: {
          projectName: projectName !== undefined ? projectName : existingProject.projectName,
          selectedTheme: selectedTheme !== undefined ? selectedTheme : existingProject.selectedTheme,
          reportLanguage: reportLanguage !== undefined ? reportLanguage : existingProject.reportLanguage,
          reportingPeriodStart: reportingPeriodStart ? new Date(reportingPeriodStart) : null,
          reportingPeriodEnd: reportingPeriodEnd ? new Date(reportingPeriodEnd) : null,
          comparisonPeriodStart: comparisonPeriodStart ? new Date(comparisonPeriodStart) : null,
          comparisonPeriodEnd: comparisonPeriodEnd ? new Date(comparisonPeriodEnd) : null,
          pdfTitle: pdfTitle !== undefined ? pdfTitle : existingProject.pdfTitle,
          clientLogoUrl: clientLogoUrl !== undefined ? clientLogoUrl : existingProject.clientLogoUrl,
        },
      });

      // 2. Sync ProjectSources if provided
      if (sourceInputs) {
        // Delete existing sources first
        await tx.projectSource.deleteMany({
          where: { projectId: id },
        });

        // Insert new active sources
        for (const src of sourceInputs) {
          await tx.projectSource.create({
            data: {
              projectId: id,
              sourceType: src.sourceType,
              oauthConnectionId: src.oauthConnectionId || null,
              externalAccountId: src.externalAccountId,
              externalAccountName: src.externalAccountName || "",
              primaryConversion: src.primaryConversion || null,
              isEnabled: src.isEnabled,
            },
          });
        }
      }

      // 3. Sync ProjectNotes if provided
      if (notes && Array.isArray(notes)) {
        // Delete existing notes first
        await tx.projectNote.deleteMany({
          where: { projectId: id },
        });

        // Insert new notes
        for (const note of notes as NoteInput[]) {
          await tx.projectNote.create({
            data: {
              projectId: id,
              noteType: note.noteType,
              noteText: note.noteText,
            },
          });
        }
      }
    });

    return NextResponse.json({ message: "Проектът е записан успешно." });
  } catch (error: any) {
    console.error("Project PATCH error:", error);
    return NextResponse.json({ error: "Проектът не можа да бъде записан. Опитайте отново." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: ProjectPatchProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  try {
    const { id } = await params;

    const result = await prisma.project.deleteMany({
      where: { id, userId: (session.user as any).id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Проектът не е намерен." }, { status: 404 });
    }

    return NextResponse.json({ message: "Проектът е изтрит." });
  } catch (error) {
    console.error("Project DELETE error:", error);
    return NextResponse.json({ error: "Проектът не можа да бъде изтрит. Опитайте отново." }, { status: 500 });
  }
}
