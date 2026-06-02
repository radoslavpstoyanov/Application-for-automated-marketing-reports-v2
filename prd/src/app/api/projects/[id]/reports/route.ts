import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

interface ReportsRouteProps {
  params: Promise<{ id: string }>;
}

function createDownloadUrl(projectId: string, report: { id: string; fileUrl: string }) {
  if (!report.fileUrl) return "";
  return `/api/projects/${projectId}/reports/${report.id}/download`;
}

function serializeReport(projectId: string, report: { id: string; fileName: string; fileUrl: string; generatedAt: Date }) {
  return {
    id: report.id,
    fileName: report.fileName,
    fileUrl: createDownloadUrl(projectId, report),
    generatedAt: report.generatedAt.toISOString(),
  };
}

export async function GET(req: Request, { params }: ReportsRouteProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Проектът не е намерен." }, { status: 404 });
  }

  const reports = await prisma.generatedReport.findMany({
    where: { projectId: id, generatedByUserId: userId },
    orderBy: { generatedAt: "desc" },
    take: 25,
  });

  return NextResponse.json({ reports: reports.map((report) => serializeReport(id, report)) });
}

export async function POST(req: Request, { params }: ReportsRouteProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const fileData = typeof body.fileData === "string" ? body.fileData.trim() : "";
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";

  if (!fileName) {
    return NextResponse.json({ error: "Липсва име на отчет." }, { status: 400 });
  }

  if (!fileData && !fileUrl) {
    return NextResponse.json({ error: "Липсва PDF файл за запис." }, { status: 400 });
  }

  if (fileData && !fileData.startsWith("data:application/pdf")) {
    return NextResponse.json({ error: "Невалиден PDF формат." }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Проектът не е намерен." }, { status: 404 });
  }

  const report = await prisma.generatedReport.create({
    data: {
      projectId: id,
      generatedByUserId: userId,
      fileName,
      fileUrl: fileData || fileUrl,
    },
  });

  return NextResponse.json({ report: serializeReport(id, report) }, { status: 201 });
}
