"use client";

import { useState } from "react";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/Toast";

export default function SettingsClient({ 
  session 
}: { 
  session: Session 
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError("Моля, въведете текущата си парола за потвърждение.");
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setError("Новите пароли не съвпадат.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newEmail, newPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Грешка при обновяване");

      setMessage("Профилът беше успешно обновен.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      
      // Allow time to read message before possible redirect (if email changed)
      setTimeout(() => {
        setMessage("");
      }, 3000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{ padding: "4rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "3rem" }}>Настройки на профила</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
        
        {/* Account Section */}
        <section className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
          <h2 style={{ fontSize: "1.4rem", marginBottom: "1.5rem" }}>Профил</h2>
          
          <form onSubmit={handleUpdateAccount} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Имейл</label>
                <input 
                  type="email" 
                  placeholder={session.user?.email || ""} 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                />
              </div>
              <div style={{ visibility: "hidden" }}>{/* Spacer for grid */}</div>
              
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Нова парола (по желание)</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Потвърди нова парола</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                />
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.5rem 0" }} />
            
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--primary)" }}>Текуща парола (задължителна за запазване)</label>
              <input 
                type="password" 
                placeholder="Въведете текущата си парола" 
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                style={{ maxWidth: "300px" }}
              />
            </div>

            <div>
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Запазване..." : "ЗАПАЗИ ПРОМЕНИТЕ"}
              </button>
            </div>
          </form>
        </section>

        {/* Integrations Link Section */}
        <section className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
          <h2 style={{ fontSize: "1.4rem", marginBottom: "1.5rem" }}>Интеграции</h2>
          <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem", fontSize: "0.9rem" }}>
            Управлявайте връзките с външни платформи като Google Analytics и Meta Ads.
          </p>
          <button 
            type="button" 
            className="secondary" 
            onClick={() => router.push("/integrations")}
          >
            КЪМ ИНТЕГРАЦИИ →
          </button>
        </section>

      </div>

      {error && <Toast message={error} onClose={() => setError("")} />}
      {message && <Toast message={message} type="success" onClose={() => setMessage("")} />}
    </div>
  );
}
