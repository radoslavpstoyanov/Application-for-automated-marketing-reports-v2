import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function DELETE(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { provider } = await params; // "google" or "meta"


    if (provider !== "google" && provider !== "meta") {
      return NextResponse.json({ error: "Избраната интеграция не се поддържа." }, { status: 400 });
    }

    await prisma.oAuthConnection.deleteMany({
      where: {
        userId: userId,
        provider: provider
      }
    });

    return NextResponse.json({ message: "Connection removed" }, { status: 200 });
  } catch (error) {
    console.error("OAuth disconnect error:", error);
    return NextResponse.json({ error: "Интеграцията не можа да бъде прекъсната. Опитайте отново." }, { status: 500 });
  }
}
