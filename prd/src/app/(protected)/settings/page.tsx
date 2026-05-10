import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import SettingsClient from "./SettingsClient";

const prisma = new PrismaClient();

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  // Pass necessary data to the client component
  return <SettingsClient session={session} />;
}
