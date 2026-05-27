"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

interface Project {
  id: string;
  projectName: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const projectsSectionActive = pathname === "/dashboard" || pathname.startsWith("/projects/");
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  
  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error("Failed to fetch projects for sidebar");
    }
  };

  useEffect(() => {
    fetchProjects();
    
    // Listen for custom event to refetch when projects change
    const handleProjectUpdate = () => fetchProjects();
    window.addEventListener("project-updated", handleProjectUpdate);
    
    return () => window.removeEventListener("project-updated", handleProjectUpdate);
  }, []);

  return (
    <aside style={{
      width: "260px",
      height: "100vh",
      position: "fixed",
      left: 0,
      top: 0,
      background: "var(--card)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "1.25rem 1rem",
      zIndex: 1000
    }}>
      {/* Logo Section */}
      <div style={{ marginBottom: "2rem", padding: "0.25rem 0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Image src="/logo.webp" alt="Vectory" width={32} height={32} style={{ borderRadius: "4px" }} />
        <span style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--primary-dark)" }}>Vectory Reports</span>
      </div>

      {/* Main Links */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1, overflowY: "auto" }}>
        <Link 
          href="/dashboard"
          style={{
            padding: "0.7rem 0.75rem",
            borderRadius: "0.5rem",
            color: projectsSectionActive ? "var(--primary-medium)" : "var(--secondary-foreground)",
            background: projectsSectionActive ? "var(--secondary)" : "transparent",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: "600",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => { if (!projectsSectionActive) e.currentTarget.style.background = "var(--secondary)" }}
          onMouseLeave={(e) => { if (!projectsSectionActive) e.currentTarget.style.background = "transparent" }}
        >
          Проекти
        </Link>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "0.7rem" }}>
          {projects.map(p => {
            const isActive = pathname === `/projects/${p.id}`;
            return (
              <Link 
                key={p.id}
                href={`/projects/${p.id}`}
                style={{
                  padding: "0.4rem 0.75rem",
                  paddingLeft: "2.25rem", // Indent under projects
                  borderRadius: "0.5rem",
                  color: isActive ? "var(--primary-medium)" : "var(--muted-foreground)",
                  background: isActive ? "var(--secondary)" : "transparent",
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--secondary)"; e.currentTarget.style.color = "var(--foreground)" }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted-foreground)" } }}
              >
                {p.projectName}
              </Link>
            )
          })}
        </div>

        {[
          { href: "/integrations", label: "Интеграции" },
        ].map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0.7rem 0.75rem",
                borderRadius: "0.5rem",
                color: isActive ? "var(--primary-medium)" : "var(--secondary-foreground)",
                background: isActive ? "var(--secondary)" : "transparent",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: "600",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--secondary)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Section Bottom */}
      <div style={{ 
        marginTop: "auto", 
        paddingTop: "1rem", 
        borderTop: "1px solid var(--border)",
        position: "relative"
      }}>
        <Link
          href="/settings"
          style={{
            display: "block",
            margin: "0 0.5rem 1rem",
            padding: "0.7rem 0.75rem",
            borderRadius: "0.5rem",
            color: pathname === "/settings" ? "var(--primary-medium)" : "var(--secondary-foreground)",
            background: pathname === "/settings" ? "var(--secondary)" : "transparent",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: "600",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { if (pathname !== "/settings") e.currentTarget.style.background = "var(--secondary)"; }}
          onMouseLeave={(e) => { if (pathname !== "/settings") e.currentTarget.style.background = "transparent"; }}
        >
          Настройки
        </Link>

        <div style={{ 
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
          padding: "0.25rem 0.5rem 0"
        }}>
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {session?.user?.name || "Потребител"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {session?.user?.email}
            </span>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="danger"
            style={{ 
              width: "100%",
              padding: "0.65rem 0.75rem",
              borderRadius: "0.5rem",
              textAlign: "left",
              fontSize: "0.85rem"
            }}
          >
            Изход
          </button>
        </div>
      </div>
    </aside>
  );
}
