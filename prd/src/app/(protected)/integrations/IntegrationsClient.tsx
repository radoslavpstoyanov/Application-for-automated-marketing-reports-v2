"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/Toast";

interface OAuthConnection {
  id: string;
  provider: string;
  connectionStatus: string;
}

export default function IntegrationsClient({ connections }: { connections: OAuthConnection[] }) {
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [tokens, setTokens] = useState({ accessToken: "", refreshToken: "" });
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const handleConnect = async (provider: string) => {
    if (!tokens.accessToken) {
      setError("Моля, въведете Access Token.");
      return;
    }
    setIsSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/oauth/${provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokens)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || "Успешно свързване");
        setExpandedProvider(null);
        setTokens({ accessToken: "", refreshToken: "" });
        router.refresh();
      } else {
        throw new Error(data.error || "Неуспешно свързване");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      const res = await fetch(`/api/oauth/${provider}/disconnect`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        throw new Error("Неуспешно прекъсване на връзката");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const isConnected = (provider: string) => 
    connections.some(c => c.provider === provider && c.connectionStatus === "active");

  const openForm = (provider: string) => {
    setExpandedProvider(provider);
    setTokens({ accessToken: "", refreshToken: "" });
    setError("");
    setSuccessMsg("");
  };

  return (
    <div style={{ padding: "4rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "3rem" }}>Интеграции</h1>

      <section className="glass" style={{ padding: "2rem", borderRadius: "1rem" }}>
        <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem", fontSize: "0.9rem" }}>
          Свържете акаунтите си, за да позволите автоматично извличане на данни за вашите отчети.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Google */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            padding: "1.5rem", 
            border: "1px solid var(--border)", 
            borderRadius: "0.75rem" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>Google Analytics & Search Console</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>Достъп до данни за трафик и търсене</p>
              </div>
              <div>
                {isConnected("google") ? (
                  <button className="secondary" style={{ color: "#ef4444" }} onClick={() => handleDisconnect("google")}>
                    Прекъсни връзката
                  </button>
                ) : (
                  expandedProvider !== "google" && (
                    <button className="primary" onClick={() => openForm("google")}>
                      СВЪРЖИ GOOGLE
                    </button>
                  )
                )}
              </div>
            </div>

            {expandedProvider === "google" && !isConnected("google") && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Access Token (задължителен)</label>
                  <input 
                    type="text" 
                    placeholder="Въведете вашия Google Access Token" 
                    value={tokens.accessToken}
                    onChange={(e) => setTokens({...tokens, accessToken: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Refresh Token (по желание)</label>
                  <input 
                    type="text" 
                    placeholder="Въведете Refresh Token" 
                    value={tokens.refreshToken}
                    onChange={(e) => setTokens({...tokens, refreshToken: e.target.value})}
                  />
                </div>
                <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                  <button className="secondary" onClick={() => setExpandedProvider(null)}>Отмяна</button>
                  <button className="primary" onClick={() => handleConnect("google")} disabled={isSaving}>
                    {isSaving ? "Запазване..." : "ЗАПАЗИ"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Meta */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            padding: "1.5rem", 
            border: "1px solid var(--border)", 
            borderRadius: "0.75rem" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>Meta (Facebook/Instagram) Ads</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>Достъп до данни за рекламни кампании</p>
              </div>
              <div>
                {isConnected("meta") ? (
                  <button className="secondary" style={{ color: "#ef4444" }} onClick={() => handleDisconnect("meta")}>
                    Прекъсни връзката
                  </button>
                ) : (
                  expandedProvider !== "meta" && (
                    <button className="primary" onClick={() => openForm("meta")}>
                      СВЪРЖИ META
                    </button>
                  )
                )}
              </div>
            </div>

            {expandedProvider === "meta" && !isConnected("meta") && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Access Token (задължителен)</label>
                  <input 
                    type="text" 
                    placeholder="Въведете вашия Meta Access Token" 
                    value={tokens.accessToken}
                    onChange={(e) => setTokens({...tokens, accessToken: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Refresh Token (по желание)</label>
                  <input 
                    type="text" 
                    placeholder="Въведете Refresh Token" 
                    value={tokens.refreshToken}
                    onChange={(e) => setTokens({...tokens, refreshToken: e.target.value})}
                  />
                </div>
                <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                  <button className="secondary" onClick={() => setExpandedProvider(null)}>Отмяна</button>
                  <button className="primary" onClick={() => handleConnect("meta")} disabled={isSaving}>
                    {isSaving ? "Запазване..." : "ЗАПАЗИ"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && <Toast message={error} type="error" onClose={() => setError("")} />}
      {successMsg && <Toast message={successMsg} type="success" onClose={() => setSuccessMsg("")} />}
    </div>
  );
}
