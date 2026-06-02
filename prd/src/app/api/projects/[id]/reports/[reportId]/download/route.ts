import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

interface DownloadRouteProps {
  params: Promise<{ id: string; reportId: string }>;
}

function encodeDispositionFileName(fileName: string) {
  const originalName = fileName.trim() || "report.pdf";
  const asciiFallback = originalName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\\r\n]/g, "").trim() || "report.pdf";
  const encodedName = encodeURIComponent(originalName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}

function extractPdfBase64(fileUrl: string) {
  if (!fileUrl.startsWith("data:application/pdf")) {
    return null;
  }

  const base64Marker = ";base64,";
  const base64MarkerIndex = fileUrl.indexOf(base64Marker);
  if (base64MarkerIndex === -1) {
    return null;
  }

  const base64Data = fileUrl.slice(base64MarkerIndex + base64Marker.length).trim();
  return base64Data || null;
}

export async function GET(req: Request, { params }: DownloadRouteProps) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id, reportId } = await params;

    const report = await prisma.generatedReport.findFirst({
      where: {
        id: reportId,
        projectId: id,
        generatedByUserId: userId,
      },
      include: {
        project: {
          select: { userId: true },
        },
      },
    });

    if (!report || report.project.userId !== userId || !report.fileUrl) {
      return NextResponse.json({ error: "Отчетът не е намерен." }, { status: 404 });
    }

    if (report.fileUrl.startsWith("http://") || report.fileUrl.startsWith("https://")) {
      return NextResponse.redirect(new URL(report.fileUrl));
    }

    const base64Data = extractPdfBase64(report.fileUrl);
    if (!base64Data) {
      return NextResponse.json({ error: "PDF файлът не е наличен." }, { status: 404 });
    }

    const buffer = Buffer.from(base64Data, "base64");

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": encodeDispositionFileName(report.fileName),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Report download failed:", error);
    return NextResponse.json({ error: "Отчетът не може да бъде свален." }, { status: 500 });
  }
}
