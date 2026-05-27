import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const connection = await prisma.oAuthConnection.findFirst({
    where: { userId, provider: "meta", connectionStatus: "active" },
  });

  if (!connection) {
    return NextResponse.json({ error: "Няма свързан Meta акаунт." }, { status: 404 });
  }

  try {
    // Check token expiry
    if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      await prisma.oAuthConnection.update({
        where: { id: connection.id },
        data: { connectionStatus: "expired" },
      });
      return NextResponse.json({ error: "Meta връзката е изтекла. Свържете акаунта отново." }, { status: 401 });
    }

    // Fetch Ad Accounts via Graph API
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency&limit=100&access_token=${connection.accessToken}`
    );
    const data = await res.json();

    if (data.error) {
      console.error("Meta Graph API error:", data.error);
      return NextResponse.json({ error: "Meta акаунтите не могат да бъдат заредени. Проверете връзката си." }, { status: 400 });
    }

    // account_status: 1 = ACTIVE, 2 = DISABLED, 3 = UNSETTLED, etc.
    const statusLabel: Record<number, string> = {
      1: "Активен",
      2: "Деактивиран",
      3: "Неуреден",
      7: "Архивиран",
      9: "Одобрен",
    };

    return NextResponse.json({
      adAccounts: (data.data ?? []).map((a: any) => ({
        id: a.id,             // e.g. "act_123456789"
        name: a.name,
        status: statusLabel[a.account_status] ?? "Непознат",
        currency: a.currency,
      })),
    });
  } catch (err) {
    console.error("Meta accounts fetch error:", err);
    return NextResponse.json({ error: "Meta акаунтите не могат да бъдат заредени в момента." }, { status: 500 });
  }
}
