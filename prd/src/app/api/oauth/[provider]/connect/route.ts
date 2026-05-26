import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { provider } = await params; // "google" or "meta"


    if (provider !== "google" && provider !== "meta") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const { accessToken, refreshToken } = await req.json();

    if (!accessToken) {
      return NextResponse.json({ error: "Access token is required" }, { status: 400 });
    }
    
    // Check if it already exists
    const existing = await prisma.oAuthConnection.findFirst({
      where: { userId, provider }
    });

    if (existing) {
      await prisma.oAuthConnection.update({
        where: { id: existing.id },
        data: { 
          accessToken,
          refreshToken: refreshToken || null,
          connectionStatus: "active"
        }
      });
    } else {
      await prisma.oAuthConnection.create({
        data: {
          userId,
          provider,
          accessToken,
          refreshToken: refreshToken || null,
          connectionStatus: "active"
        }
      });
    }

    return NextResponse.json({ message: "Успешно свързване" }, { status: 200 });
  } catch (error) {
    console.error("OAuth connect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
