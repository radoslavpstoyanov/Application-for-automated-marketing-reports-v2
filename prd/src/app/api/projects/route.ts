import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: (session.user as any).id },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  try {
    const { projectName } = await req.json();

    if (!projectName) {
      return NextResponse.json({ error: "Въведете име на проекта." }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        projectName,
        userId: (session.user as any).id,
        selectedTheme: "Lead Group",
        reportLanguage: "bg"
      }
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Проектът не можа да бъде създаден. Опитайте отново." }, { status: 500 });
  }
}
