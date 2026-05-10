"use client";

import { signOut } from "next-auth/react";
import { Session } from "next-auth";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Project {
  id: string;
  projectName: string;
  updatedAt: string;
}

export default function DashboardClient({ session }: { session: Session }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchProjects();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: newProjectName }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowNewModal(false);
        setNewProjectName("");
        router.push(`/projects/${data.id}`);
      }
    } catch (err) {
      console.error("Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue || !selectedProject) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: renameValue }),
      });
      if (res.ok) {
        setShowRenameModal(false);
        setRenameValue("");
        setSelectedProject(null);
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to rename project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActiveMenu(null);
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      if (res.ok) fetchProjects();
    } catch (err) {
      console.error("Failed to duplicate project");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, { method: "DELETE" });
      if (res.ok) {
        setShowDeleteModal(false);
        setSelectedProject(null);
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to delete project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="glass" style={{ padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 1000 }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Image src="/logo.webp" alt="Vectory" width={32} height={32} style={{ borderRadius: "4px" }} />
          Marketing Reports
        </h1>
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

      <main className="container" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "3rem" }}>
          <div>
            <h2 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>Проекти</h2>
            <p style={{ color: "var(--muted-foreground)" }}>Управлявайте вашите маркетингови отчети</p>
          </div>
          <button className="primary" onClick={() => setShowNewModal(true)}>+ НОВ ПРОЕКТ</button>
        </div>

        {loading ? (
          <div className="flex-center" style={{ padding: "4rem" }}>
            <p>Зареждане на проекти...</p>
          </div>
        ) : projects.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {projects.map((project) => (
              <div 
                key={project.id} 
                className={`glass project-card ${activeMenu === project.id ? "active" : ""}`}
                style={{ 
                  padding: "1.5rem", 
                  borderRadius: "1rem", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  position: "relative",
                  zIndex: activeMenu === project.id ? 50 : 1,
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: activeMenu === project.id ? "var(--primary)" : "var(--border)"
                }}
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>{project.projectName}</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                    Последна промяна: {new Date(project.updatedAt).toLocaleDateString("bg-BG")}
                  </p>
                </div>
                
                <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setActiveMenu(activeMenu === project.id ? null : project.id)}
                    style={{ 
                      background: "transparent", 
                      padding: "0.5rem", 
                      fontSize: "1.5rem", 
                      color: activeMenu === project.id ? "var(--primary)" : "var(--muted-foreground)",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      transition: "color 0.2s ease"
                    }}
                  >
                    ⋮
                  </button>

                  {activeMenu === project.id && (
                    <div ref={menuRef} className="glass" style={{ 
                      position: "absolute", 
                      right: 0, 
                      top: "calc(100% + 5px)", 
                      width: "200px", 
                      zIndex: 1000, 
                      padding: "0.5rem", 
                      borderRadius: "0.75rem",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                      border: "1px solid var(--primary)",
                      background: "#002333"
                    }}>
                      <button 
                        onClick={() => { setSelectedProject(project); setRenameValue(project.projectName); setShowRenameModal(true); setActiveMenu(null); }}
                        style={{ width: "100%", textAlign: "left", padding: "0.75rem", fontSize: "0.9rem", background: "transparent", color: "white", borderRadius: "0.5rem" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--secondary)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        Преименувай
                      </button>
                      <button 
                        onClick={() => handleDuplicate(project.id)}
                        style={{ width: "100%", textAlign: "left", padding: "0.75rem", fontSize: "0.9rem", background: "transparent", color: "white", borderRadius: "0.5rem" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--secondary)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        Дублиране
                      </button>
                      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.4rem 0" }} />
                      <button 
                        onClick={() => { setSelectedProject(project); setShowDeleteModal(true); setActiveMenu(null); }}
                        style={{ width: "100%", textAlign: "left", padding: "0.75rem", fontSize: "0.9rem", background: "transparent", color: "#ef4444", borderRadius: "0.5rem" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        Изтрий
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass" style={{ padding: "5rem", borderRadius: "1rem", textAlign: "center", borderStyle: "dashed" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.4rem" }}>Все още нямате проекти</h3>
            <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem", maxWidth: "400px", marginInline: "auto" }}>
              Създайте първия си проект, за да започнете да генерирате професионални маркетингови отчети.
            </p>
            <button className="primary" onClick={() => setShowNewModal(true)}>СЪЗДАЙ ПЪРВИЯ СИ ПРОЕКТ</button>
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="flex-center" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }}>
          <div className="glass" style={{ width: "100%", maxWidth: "450px", padding: "2.5rem", borderRadius: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.5rem" }}>Нов проект</h2>
            <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem", fontSize: "0.9rem" }}>Въведете име за вашия нов маркетингов отчет.</p>
            <form onSubmit={handleCreateProject}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Име на проекта</label>
                <input autoFocus placeholder="напр. SEO Отчет - Януари 2024" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} required />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setShowNewModal(false)}>Отказ</button>
                <button type="submit" className="primary" style={{ flex: 2 }} disabled={submitting}>{submitting ? "Създаване..." : "Създай проект"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Project Modal */}
      {showRenameModal && (
        <div className="flex-center" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }}>
          <div className="glass" style={{ width: "100%", maxWidth: "450px", padding: "2.5rem", borderRadius: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.5rem" }}>Преименуване</h2>
            <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem", fontSize: "0.9rem" }}>Променете името на проекта.</p>
            <form onSubmit={handleRenameProject}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Ново име</label>
                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => { setShowRenameModal(false); setSelectedProject(null); }}>Отказ</button>
                <button type="submit" className="primary" style={{ flex: 2 }} disabled={submitting}>{submitting ? "Запази" : "Запази промените"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="flex-center" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }}>
          <div className="glass" style={{ width: "100%", maxWidth: "450px", padding: "2.5rem", borderRadius: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.5rem", color: "#ef4444" }}>Изтриване на проект</h2>
            <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem", fontSize: "0.9rem" }}>
              Сигурни ли сте, че искате да изтриете проекта <strong>"{selectedProject?.projectName}"</strong>? Това действие е необратимо.
            </p>
            
            <div style={{ display: "flex", gap: "1rem" }}>
              <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => { setShowDeleteModal(false); setSelectedProject(null); }}>Отказ</button>
              <button 
                type="button" 
                className="primary" 
                style={{ flex: 1, background: "#ef4444" }} 
                onClick={handleDeleteConfirmed} 
                disabled={submitting}
              >
                {submitting ? "Изтриване..." : "Да, изтрий"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .project-card:hover {
          border-color: var(--primary) !important;
        }
        .project-card.active {
          border-color: var(--primary) !important;
          box-shadow: 0 0 15px rgba(0, 223, 154, 0.2);
        }
      `}</style>
    </div>
  );
}
