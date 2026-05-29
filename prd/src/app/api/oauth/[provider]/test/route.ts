import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { reportLogger } from "@/lib/report/logger";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
    }

    const { provider } = await params; // "google" or "meta"
    if (provider !== "google" && provider !== "meta") {
      return NextResponse.json({ error: "Избраната интеграция не се поддържа." }, { status: 400 });
    }

    const { accessToken } = await req.json();

    if (!accessToken) {
      return NextResponse.json({ error: "Въведете токен за достъп за проверка." }, { status: 400 });
    }

    const endpoint = provider === "google"
      ? "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=1"
      : "https://graph.facebook.com/v19.0/me?fields=id";
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json({ error: "Токенът не може да бъде потвърден от доставчика." }, { status: 400 });
    }

    return NextResponse.json({ message: "Връзката е потвърдена успешно." }, { status: 200 });
  } catch (error) {
    reportLogger.warn("OAuth token test failed");
    return NextResponse.json({ error: "Връзката не можа да бъде проверена. Опитайте отново." }, { status: 500 });
  }
}
