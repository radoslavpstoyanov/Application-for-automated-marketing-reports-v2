"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex-center" style={{ height: "100vh" }}>
        <p>Зареждане...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="glass" style={{ padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Marketing Reports</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--muted-foreground)" }}>{session.user?.email}</span>
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })} 
            className="secondary" 
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          >
            Изход
          </button>
        </div>
      </header>

      <main className="container" style={{ paddingTop: "4rem" }}>
        <div style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Добре дошли, {session.user?.name || "Потребител"}!</h2>
          <p style={{ color: "var(--muted-foreground)" }}>Вашето табло за управление на маркетингови отчети.</p>
        </div>

        <div className="glass" style={{ padding: "4rem", borderRadius: "1rem", textAlign: "center", borderStyle: "dashed" }}>
          <h3 style={{ marginBottom: "1rem" }}>Все още нямате проекти</h3>
          <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem" }}>Създайте първия си проект, за да започнете да генерирате отчети.</p>
          <button className="primary">+ Нов проект</button>
        </div>
      </main>
    </div>
  );
}
