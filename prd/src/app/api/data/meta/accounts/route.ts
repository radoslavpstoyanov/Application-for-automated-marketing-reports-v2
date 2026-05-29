import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getProviderAccessToken } from "@/lib/integrations/tokens";
import { reportLogger } from "@/lib/report/logger";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id as string;
    const accessToken = await getProviderAccessToken(prisma, userId, "meta");
    const params = new URLSearchParams({
      fields: "id,name,account_status,currency",
      limit: "100",
    });

    const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();

    if (!response.ok || data.error) {
      reportLogger.warn("Meta ad accounts fetch failed");
      return NextResponse.json({ error: "Meta акаунтите не могат да бъдат заредени. Проверете връзката си." }, { status: 400 });
    }

    const statusLabel: Record<number, string> = {
      1: "Активен",
      2: "Деактивиран",
      3: "Неуреден",
      7: "Архивиран",
      9: "Одобрен",
    };

    return NextResponse.json({
      adAccounts: (data.data ?? []).map((account: any) => ({
        id: account.id,
        name: account.name,
        status: statusLabel[account.account_status] ?? "Непознат",
        currency: account.currency,
      })),
    });
  } catch (error: any) {
    reportLogger.warn("Meta accounts fetch failed");
    const status = error.message?.includes("връзката") || error.message?.includes("интеграция") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Meta акаунтите не могат да бъдат заредени в момента." }, { status });
  }
}
