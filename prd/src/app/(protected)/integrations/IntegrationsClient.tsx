"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/Toast";

interface OAuthConnection {
  id: string;
  provider: string;
  connectionStatus: string;
  tokenExpiresAt?: string | null;
}

interface GA4Property {
  id: string;
  name: string;
  websiteUrl?: string | null;
}

interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

interface MetaAdAccount {
  id: string;
  name: string;
  status: string;
  currency: string;
}

interface GoogleAccounts {
  ga4Properties: GA4Property[];
  gscSites: GSCSite[];
  warnings?: string[];
}

interface MetaAccounts {
  adAccounts: MetaAdAccount[];
}

interface Props {
  connections: OAuthConnection[];
  successParam?: string;
  errorParam?: string;
}

const errorMessages: Record<string, string> = {
  google_denied: "Отказахте достъп до Google. Опитайте отново.",
  google_token: "Грешка при получаване на Google токен.",
  google_server: "Сървърна грешка при свързване с Google.",
  meta_denied: "Отказахте достъп до Meta. Опитайте отново.",
  meta_token: "Грешка при получаване на Meta токен.",
  meta_server: "Сървърна грешка при свързване с Meta.",
};

const successMessages: Record<string, string> = {
  google: "Google акаунтът е успешно свързан!",
  meta: "Meta акаунтът е успешно свързан!",
};

export default function IntegrationsClient({
  connections,
  successParam,
  errorParam,
}: Props) {
  const [error, setError] = useState(errorParam ? (errorMessages[errorParam] ?? "Неизвестна грешка.") : "");
  const [successMsg, setSuccessMsg] = useState(successParam ? (successMessages[successParam] ?? "Успешно свързване!") : "");
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccounts | null>(null);
  const [metaAccounts, setMetaAccounts] = useState<MetaAccounts | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const router = useRouter();

  const isConnected = (provider: string) =>
    connections.some((c) => c.provider === provider && c.connectionStatus === "active");

  const isExpired = (provider: string) =>
    connections.some((c) => c.provider === provider && c.connectionStatus === "expired");

  const fetchGoogleAccounts = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const res = await fetch("/api/data/google/accounts");
      const data = await res.json();
      if (res.ok) {
        setGoogleAccounts(data);
        if (data.warnings?.length) {
          setError(data.warnings.join(" "));
        }
      } else {
        throw new Error(data.error || "Неуспешно зареждане на Google акаунтите.");
      }
    } catch (err: any) {
      setError(err.message || "Неуспешно зареждане на Google акаунтите.");
    } finally {
      setLoadingGoogle(false);
    }
  }, []);

  const fetchMetaAccounts = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const res = await fetch("/api/data/meta/accounts");
      const data = await res.json();
      if (res.ok) {
        setMetaAccounts(data);
      } else {
        throw new Error(data.error || "Неуспешно зареждане на Meta акаунтите.");
      }
    } catch (err: any) {
      setError(err.message || "Неуспешно зареждане на Meta акаунтите.");
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  // Fetch account lists when an active provider connection is available.
  useEffect(() => {
    if (connections.some((c) => c.provider === "google" && c.connectionStatus === "active")) fetchGoogleAccounts();
    if (connections.some((c) => c.provider === "meta" && c.connectionStatus === "active")) fetchMetaAccounts();
  }, [connections, fetchGoogleAccounts, fetchMetaAccounts]);

  const handleDisconnect = async (provider: string) => {
    try {
      const res = await fetch(`/api/oauth/${provider}/disconnect`, { method: "DELETE" });
      if (res.ok) {
        if (provider === "google") setGoogleAccounts(null);
        if (provider === "meta") setMetaAccounts(null);
        router.refresh();
      } else {
        throw new Error("Неуспешно прекъсване на връзката");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cardStyle = {
    display: "flex",
    flexDirection: "column" as const,
    padding: "1.5rem",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    background: "var(--card)",
    boxShadow: "var(--shadow-card)",
  };

  const headerRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
  };

  const statusBadge = (connected: boolean, expired: boolean) => (
    <span
      style={{
        fontSize: "0.75rem",
        fontWeight: "600",
        padding: "0.2rem 0.6rem",
        borderRadius: "9999px",
        background: expired
          ? "rgba(239,68,68,0.1)"
          : connected
          ? "rgba(67,179,112,0.12)"
          : "rgba(148,163,184,0.15)",
        color: expired ? "#ef4444" : connected ? "var(--primary)" : "var(--muted-foreground)",
        marginTop: "0.25rem",
        display: "inline-block",
      }}
    >
      {expired ? "Изтекъл токен" : connected ? "Свързан" : "Не е свързан"}
    </span>
  );

  const accountListStyle = {
    marginTop: "1.25rem",
    paddingTop: "1.25rem",
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  };

  const sectionLabel = {
    fontSize: "0.75rem",
    fontWeight: "700",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--muted-foreground)",
    marginBottom: "0.4rem",
  };

  const accountItem = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.5rem 0.75rem",
    background: "var(--secondary)",
    borderRadius: "0.5rem",
    fontSize: "0.85rem",
  };

  return (
    <div style={{ padding: "4rem 2rem", maxWidth: "860px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>Интеграции</h1>
      <p style={{ color: "var(--muted-foreground)", marginBottom: "3rem", fontSize: "0.9rem" }}>
        Свържете акаунтите си, за да позволите автоматично извличане на данни за вашите отчети.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* ── Google ── */}
        <div style={cardStyle}>
          <div style={headerRowStyle}>
            <div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.3rem" }}>
                Google Analytics &amp; Search Console
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
                Достъп до данни за трафик, търсене и реклами в Google
              </p>
              {statusBadge(isConnected("google"), isExpired("google"))}
            </div>
            <div style={{ flexShrink: 0 }}>
              {isConnected("google") ? (
                <button
                  className="danger"
                  onClick={() => handleDisconnect("google")}
                >
                  Прекъсни връзката
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => (window.location.href = "/api/oauth/google/authorize")}
                >
                  СВЪРЖИ GOOGLE
                </button>
              )}
            </div>
          </div>

          {/* Google accounts list */}
          {isConnected("google") && (
            <div style={accountListStyle}>
              {loadingGoogle ? (
                <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
                  Зареждане на акаунти...
                </p>
              ) : googleAccounts ? (
                <>
                  {googleAccounts.ga4Properties.length > 0 && (
                    <div>
                      <p style={sectionLabel}>GA4 Пропъртита ({googleAccounts.ga4Properties.length})</p>
                      {googleAccounts.ga4Properties.map((p) => (
                        <div key={p.id} style={{ ...accountItem, marginBottom: "0.35rem" }}>
                          <span>{p.name}</span>
                          {p.websiteUrl && (
                            <span style={{ color: "var(--muted-foreground)", fontSize: "0.78rem" }}>
                              {p.websiteUrl}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {googleAccounts.gscSites.length > 0 && (
                    <div>
                      <p style={sectionLabel}>Search Console Сайтове ({googleAccounts.gscSites.length})</p>
                      {googleAccounts.gscSites.map((s) => (
                        <div key={s.siteUrl} style={{ ...accountItem, marginBottom: "0.35rem" }}>
                          <span>{s.siteUrl}</span>
                          <span style={{ color: "var(--muted-foreground)", fontSize: "0.78rem" }}>
                            {s.permissionLevel}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {googleAccounts.ga4Properties.length === 0 && googleAccounts.gscSites.length === 0 && (
                    <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
                      Не са намерени GA4 пропъртита или GSC сайтове в този акаунт.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
                  Не можахме да заредим акаунтите.{" "}
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "0.85rem",
                    }}
                    onClick={fetchGoogleAccounts}
                  >
                    Опитай отново
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Meta ── */}
        <div style={cardStyle}>
          <div style={headerRowStyle}>
            <div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.3rem" }}>
                Meta (Facebook/Instagram) Ads
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
                Достъп до данни за рекламни кампании и резултати
              </p>
              {statusBadge(isConnected("meta"), isExpired("meta"))}
            </div>
            <div style={{ flexShrink: 0 }}>
              {isConnected("meta") ? (
                <button
                  className="danger"
                  onClick={() => handleDisconnect("meta")}
                >
                  Прекъсни връзката
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => (window.location.href = "/api/oauth/meta/authorize")}
                >
                  СВЪРЖИ META
                </button>
              )}
            </div>
          </div>

          {/* Meta accounts list */}
          {isConnected("meta") && (
            <div style={accountListStyle}>
              {loadingMeta ? (
                <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
                  Зареждане на акаунти...
                </p>
              ) : metaAccounts ? (
                <>
                  {metaAccounts.adAccounts.length > 0 ? (
                    <div>
                      <p style={sectionLabel}>Ad Акаунти ({metaAccounts.adAccounts.length})</p>
                      {metaAccounts.adAccounts.map((a) => (
                        <div key={a.id} style={{ ...accountItem, marginBottom: "0.35rem" }}>
                          <span>{a.name}</span>
                          <span style={{ color: "var(--muted-foreground)", fontSize: "0.78rem" }}>
                            {a.currency} · {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
                      Не са намерени Ad акаунти в този Meta акаунт.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
                  Не можахме да заредим акаунтите.{" "}
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "0.85rem",
                    }}
                    onClick={fetchMetaAccounts}
                  >
                    Опитай отново
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <Toast message={error} type="error" onClose={() => setError("")} />}
      {successMsg && <Toast message={successMsg} type="success" onClose={() => setSuccessMsg("")} />}
    </div>
  );
}
