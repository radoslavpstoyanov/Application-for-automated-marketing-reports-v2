import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

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

export async function PATCH(req: Request, { params }: ProjectPatchProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
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

    const sourceInputs = Array.isArray(sources)
      ? (sources as SourceInput[]).map((src) => ({
          ...src,
          oauthConnectionId: src.oauthConnectionId === "sandbox" ? null : (src.oauthConnectionId || null),
        }))
      : null;
    const sourceConnectionIds = sourceInputs
      ? [...new Set(sourceInputs.map((src) => src.oauthConnectionId).filter((value): value is string => !!value))]
      : [];

    if (sourceConnectionIds.length > 0) {
      const ownedConnections = await prisma.oAuthConnection.count({
        where: {
          id: { in: sourceConnectionIds },
          userId,
        },
      });

      if (ownedConnections !== sourceConnectionIds.length) {
        return NextResponse.json({ error: "Invalid OAuth connection" }, { status: 400 });
      }
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

    return NextResponse.json({ message: "Project configuration successfully updated" });
  } catch (error: any) {
    console.error("Project PATCH error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: ProjectPatchProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const result = await prisma.project.deleteMany({
      where: { id, userId: (session.user as any).id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Project DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
