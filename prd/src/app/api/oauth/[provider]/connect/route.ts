import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/integrations/tokens";
import { reportLogger } from "@/lib/report/logger";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
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

    const { accessToken, refreshToken } = await req.json();

    if (!accessToken) {
      return NextResponse.json({ error: "Въведете токен за достъп." }, { status: 400 });
    }
    
    // Check if it already exists
    const existing = await prisma.oAuthConnection.findFirst({
      where: { userId, provider }
    });

    if (existing) {
      await prisma.oAuthConnection.update({
        where: { id: existing.id },
        data: { 
          accessToken: encryptSecret(accessToken)!,
          refreshToken: encryptSecret(refreshToken),
          connectionStatus: "active"
        }
      });
    } else {
      await prisma.oAuthConnection.create({
        data: {
          userId,
          provider,
          accessToken: encryptSecret(accessToken)!,
          refreshToken: encryptSecret(refreshToken),
          connectionStatus: "active"
        }
      });
    }

    return NextResponse.json({ message: "Успешно свързване" }, { status: 200 });
  } catch (error) {
    reportLogger.warn("Manual OAuth connect failed");
    return NextResponse.json({ error: "Интеграцията не можа да бъде свързана. Опитайте отново." }, { status: 500 });
  }
}
