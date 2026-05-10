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
  const router = useRouter();

  const handleConnect = async (provider: string) => {
    try {
      const res = await fetch(`/api/oauth/${provider}/connect`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        throw new Error("Неуспешно свързване");
      }
    } catch (err: any) {
      setError(err.message);
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
            justifyContent: "space-between", 
            alignItems: "center", 
            padding: "1.5rem", 
            border: "1px solid var(--border)", 
            borderRadius: "0.75rem" 
          }}>
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
                <button className="primary" onClick={() => handleConnect("google")}>
                  СВЪРЖИ GOOGLE
                </button>
              )}
            </div>
          </div>

          {/* Meta */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            padding: "1.5rem", 
            border: "1px solid var(--border)", 
            borderRadius: "0.75rem" 
          }}>
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
                <button className="primary" onClick={() => handleConnect("meta")}>
                  СВЪРЖИ META
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && <Toast message={error} onClose={() => setError("")} />}
    </div>
  );
}
