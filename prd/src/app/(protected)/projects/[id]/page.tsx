import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id;

  // Find project and update its 'updatedAt' field to move it to the top of the dashboard
  const project = await prisma.project.updateMany({
    where: { id: params.id, userId: userId },
    data: { updatedAt: new Date() } // Forces the project to the top in 'desc' ordering
  });

  // Fetch the actual project data
  const projectData = await prisma.project.findFirst({
    where: { id: params.id, userId: userId }
  });

  if (!projectData) {
    return (
      <div className="flex-center" style={{ height: "100vh", flexDirection: "column", gap: "1rem" }}>
        <h1>Проектът не е намерен</h1>
        <Link href="/dashboard" className="primary">← Назад към таблото</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ padding: "1.5rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700" }}>{projectData.projectName}</h1>
        <button className="primary">ГЕНЕРИРАЙ ОТЧЕТ</button>
      </header>

      <main className="container" style={{ paddingTop: "4rem" }}>
        <div className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
          <h2 style={{ marginBottom: "2rem" }}>Конфигурация на проекта</h2>
          <p style={{ color: "var(--muted-foreground)" }}>Тук ще можете да настроите източниците на данни, периоди и бележки.</p>
          <div style={{ marginTop: "3rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div className="glass" style={{ padding: "1.5rem", borderStyle: "dashed" }}>
              <h3>Източници</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>Google Analytics, Search Console, Ads...</p>
            </div>
            <div className="glass" style={{ padding: "1.5rem", borderStyle: "dashed" }}>
              <h3>Бележки</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>SEO бележки, Трафик, Реклами...</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
