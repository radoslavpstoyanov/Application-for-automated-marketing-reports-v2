import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;

    const originalProject = await prisma.project.findFirst({
      where: { id, userId: (session.user as any).id },
      include: {
        projectSources: true
      }
    });

    if (!originalProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create duplicate project
    const duplicate = await prisma.project.create({
      data: {
        projectName: `${originalProject.projectName} (Copy)`,
        userId: (session.user as any).id,
        selectedTheme: originalProject.selectedTheme,
        reportLanguage: originalProject.reportLanguage,
        clientLogoUrl: originalProject.clientLogoUrl,
        pdfTitle: originalProject.pdfTitle,
        // Copy project sources
        projectSources: {
          create: originalProject.projectSources.map(source => ({
            sourceType: source.sourceType,
            oauthConnectionId: source.oauthConnectionId,
            externalAccountId: source.externalAccountId,
            externalAccountName: source.externalAccountName,
            isEnabled: source.isEnabled
          }))
        }
        // Note: ProjectNotes and GeneratedReports are NOT copied as per Task 04
      }
    });

    return NextResponse.json(duplicate);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
