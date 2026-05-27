import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

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
      return NextResponse.json({ error: "Въведете Access Token за тестване" }, { status: 400 });
    }

    // Simulate an external API call to validate the token
    await new Promise((resolve) => setTimeout(resolve, 800));

    // For the sake of the mock, we assume the token is valid if it starts with a specific prefix or is longer than 5 chars
    if (accessToken.length < 5) {
      return NextResponse.json({ error: "Невалиден тоукън (твърде кратък)" }, { status: 400 });
    }

    return NextResponse.json({ message: "Успешна връзка с външната услуга!" }, { status: 200 });
  } catch (error) {
    console.error("OAuth test error:", error);
    return NextResponse.json({ error: "Връзката не можа да бъде проверена. Опитайте отново." }, { status: 500 });
  }
}
