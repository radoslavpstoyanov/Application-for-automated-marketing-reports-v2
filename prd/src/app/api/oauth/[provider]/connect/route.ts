import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { provider: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const provider = params.provider; // "google" or "meta"

    if (provider !== "google" && provider !== "meta") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // MOCK OAUTH FLOW
    // In a real application, this endpoint would redirect to Google/Meta OAuth consent screen
    // Here we immediately simulate a successful callback and token generation
    
    // Check if it already exists
    const existing = await prisma.oAuthConnection.findFirst({
      where: { userId, provider }
    });

    if (existing) {
      await prisma.oAuthConnection.update({
        where: { id: existing.id },
        data: { 
          accessToken: `mock-access-token-${provider}-${Date.now()}`,
          refreshToken: `mock-refresh-token-${provider}-${Date.now()}`,
          connectionStatus: "active"
        }
      });
    } else {
      await prisma.oAuthConnection.create({
        data: {
          userId,
          provider,
          accessToken: `mock-access-token-${provider}-${Date.now()}`,
          refreshToken: `mock-refresh-token-${provider}-${Date.now()}`,
          connectionStatus: "active"
        }
      });
    }

    return NextResponse.json({ message: "Mock connection established" }, { status: 200 });
  } catch (error) {
    console.error("OAuth connect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
