import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import IntegrationsClient from "./IntegrationsClient";

const prisma = new PrismaClient();

interface Props {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function IntegrationsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { success, error } = await searchParams;
  const userId = (session.user as any).id;

  const raw = await prisma.oAuthConnection.findMany({
    where: { userId },
    select: { id: true, provider: true, connectionStatus: true, tokenExpiresAt: true },
  });

  // Serialize dates so the client component receives plain JSON
  const connections = raw.map((c) => ({
    id: c.id,
    provider: c.provider,
    connectionStatus: c.connectionStatus,
    tokenExpiresAt: c.tokenExpiresAt?.toISOString() ?? null,
  }));

  return (
    <IntegrationsClient
      connections={connections}
      successParam={success}
      errorParam={error}
    />
  );
}
