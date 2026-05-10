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
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
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
      padding: "1.5rem 1rem",
      zIndex: 1000
    }}>
      {/* Logo Section */}
      <div style={{ marginBottom: "2.5rem", paddingLeft: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Image src="/logo.webp" alt="Vectory" width={32} height={32} style={{ borderRadius: "4px" }} />
        <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>Vectory Reports</span>
      </div>

      {/* Main Links */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, overflowY: "auto" }}>
        
        <Link 
          href="/integrations"
          style={{
            marginTop: "0.5rem",
            marginBottom: "0",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            color: pathname === "/integrations" ? "var(--primary)" : "var(--muted-foreground)",
            background: pathname === "/integrations" ? "var(--secondary)" : "transparent",
            textDecoration: "none",
            fontSize: "0.8rem",
            textTransform: "uppercase", 
            letterSpacing: "0.05em", 
            fontWeight: "600",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => { if (pathname !== "/integrations") e.currentTarget.style.background = "var(--secondary)" }}
          onMouseLeave={(e) => { if (pathname !== "/integrations") e.currentTarget.style.background = "transparent" }}
        >
          Интеграции
        </Link>

        <Link 
          href="/dashboard"
          style={{
            marginTop: "0.5rem", 
            marginBottom: "0.25rem", 
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            color: pathname === "/dashboard" ? "var(--primary)" : "var(--muted-foreground)",
            background: pathname === "/dashboard" ? "var(--secondary)" : "transparent",
            textDecoration: "none",
            fontSize: "0.8rem", 
            textTransform: "uppercase", 
            letterSpacing: "0.05em", 
            fontWeight: "600",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => { if (pathname !== "/dashboard") e.currentTarget.style.background = "var(--secondary)" }}
          onMouseLeave={(e) => { if (pathname !== "/dashboard") e.currentTarget.style.background = "transparent" }}
        >
          Проекти
        </Link>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginTop: "0.1rem" }}>
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
                  color: isActive ? "var(--primary)" : "var(--muted-foreground)",
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
      </nav>

      {/* User Section Bottom */}
      <div style={{ 
        marginTop: "auto", 
        paddingTop: "1rem", 
        borderTop: "1px solid var(--border)",
        position: "relative"
      }}>
        {showUserMenu && (
          <div className="glass" style={{
            position: "absolute",
            bottom: "0",
            left: "calc(100% + 0.5rem)",
            width: "max-content",
            minWidth: "150px",
            borderRadius: "0.5rem",
            padding: "0.5rem",
            zIndex: 1010,
            boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }}>
            <Link 
              href="/settings"
              onClick={() => setShowUserMenu(false)}
              style={{
                display: "block",
                padding: "0.5rem",
                borderRadius: "0.3rem",
                color: "var(--foreground)",
                textDecoration: "none",
                fontSize: "0.85rem",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--secondary)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Настройки на профила
            </Link>
            <button 
              onClick={() => { setShowUserMenu(false); signOut({ callbackUrl: "/login" }); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.5rem",
                borderRadius: "0.3rem",
                color: "#ef4444",
                background: "transparent",
                border: "none",
                fontSize: "0.85rem",
                fontWeight: "normal",
                textTransform: "none",
                letterSpacing: "normal",
                transition: "background 0.2s",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--secondary)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Изход
            </button>
          </div>
        )}

        <div style={{ 
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem"
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
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ 
              background: "transparent",
              border: "none",
              color: showUserMenu ? "var(--primary)" : "var(--muted-foreground)", 
              padding: "0.4rem",
              borderRadius: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: "pointer",
              transform: showUserMenu ? "rotate(-90deg)" : "rotate(0deg)"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--secondary)"; e.currentTarget.style.color = "var(--primary)" }}
            onMouseLeave={(e) => { if (!showUserMenu) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted-foreground)" } }}
            title="Меню"
          >
            &gt;
          </button>
        </div>
      </div>
    </aside>
  );
}
