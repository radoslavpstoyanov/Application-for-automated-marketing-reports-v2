import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import ProjectClient from "./ProjectClient";

const prisma = new PrismaClient();

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id;
  const { id } = await params;

  // Find project and update its 'updatedAt' field to move it to the top of the dashboard
  try {
    await prisma.project.updateMany({
      where: { id, userId },
      data: { updatedAt: new Date() }
    });
  } catch (err) {
    console.error("Failed to update project timestamp:", err);
  }

  // Fetch the actual project data with relations
  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      projectSources: true,
      projectNotes: true,
    }
  });

  if (!project) {
    return (
      <div className="flex-center" style={{ height: "100vh", flexDirection: "column", gap: "1rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "800" }}>Проектът не е намерен</h1>
        <Link href="/dashboard" className="primary" style={{ textDecoration: "none" }}>
          ← Назад към таблото
        </Link>
      </div>
    );
  }

  // Fetch user oauth connections
  const connections = await prisma.oAuthConnection.findMany({
    where: { userId }
  });

  // Serialize everything safely for Client Component boundaries to prevent SSR hydration errors
  const serializedProject = {
    id: project.id,
    projectName: project.projectName,
    selectedTheme: project.selectedTheme,
    reportLanguage: project.reportLanguage,
    reportingPeriodStart: project.reportingPeriodStart ? project.reportingPeriodStart.toISOString() : null,
    reportingPeriodEnd: project.reportingPeriodEnd ? project.reportingPeriodEnd.toISOString() : null,
    comparisonPeriodStart: project.comparisonPeriodStart ? project.comparisonPeriodStart.toISOString() : null,
    comparisonPeriodEnd: project.comparisonPeriodEnd ? project.comparisonPeriodEnd.toISOString() : null,
    pdfTitle: project.pdfTitle,
    clientLogoUrl: project.clientLogoUrl,
  };

  const serializedSources = project.projectSources.map(s => ({
    sourceType: s.sourceType,
    oauthConnectionId: s.oauthConnectionId,
    externalAccountId: s.externalAccountId,
    externalAccountName: s.externalAccountName || "",
    primaryConversion: s.primaryConversion,
    isEnabled: s.isEnabled,
  }));

  const serializedNotes = project.projectNotes.map(n => ({
    noteType: n.noteType,
    noteText: n.noteText,
  }));

  const serializedConnections = connections.map(c => ({
    id: c.id,
    provider: c.provider,
    connectionStatus: c.connectionStatus,
  }));

  return (
    <ProjectClient
      project={serializedProject}
      sources={serializedSources}
      notes={serializedNotes}
      oauthConnections={serializedConnections}
    />
  );
}
