import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import IntegrationsClient from "./IntegrationsClient";

const prisma = new PrismaClient();

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const userId = (session.user as any).id;

  const connections = await prisma.oAuthConnection.findMany({
    where: { userId }
  });

  return <IntegrationsClient connections={connections} />;
}
