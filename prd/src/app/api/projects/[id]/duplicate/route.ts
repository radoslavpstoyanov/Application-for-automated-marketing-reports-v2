import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  try {
    const { id } = await params;

    const originalProject = await prisma.project.findFirst({
      where: { id, userId: (session.user as any).id },
      include: {
        projectSources: true
      }
    });

    if (!originalProject) {
      return NextResponse.json({ error: "Проектът не е намерен." }, { status: 404 });
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
            primaryConversion: source.primaryConversion,
            isEnabled: source.isEnabled
          }))
        }
        // Note: ProjectNotes and GeneratedReports are NOT copied as per Task 04
      }
    });

    return NextResponse.json(duplicate);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Проектът не можа да бъде дублиран. Опитайте отново." }, { status: 500 });
  }
}
