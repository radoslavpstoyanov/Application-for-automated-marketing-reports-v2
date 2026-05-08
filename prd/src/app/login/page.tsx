"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Невалиден имейл или парола");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("Възникна грешка при влизането");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: "100vh" }}>
      <div className="auth-card glass">
        <h1 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", textAlign: "center" }}>Вход</h1>
        <p style={{ marginBottom: "2rem", color: "var(--muted-foreground)", textAlign: "center", fontSize: "0.9rem" }}>
          Добре дошли отново
        </p>

        {registered && (
          <div style={{ 
            background: "rgba(34, 197, 94, 0.1)", 
            color: "#22c55e", 
            padding: "0.75rem", 
            borderRadius: "0.5rem", 
            marginBottom: "1.5rem", 
            fontSize: "0.85rem",
            textAlign: "center",
            border: "1px solid rgba(34, 197, 94, 0.2)"
          }}>
            Регистрацията беше успешна! Вече можете да влезете.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Имейл адрес</label>
            <input
              type="email"
              placeholder="ivan@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem" }}>Парола</label>
              <Link href="#" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Забравена парола?</Link>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>
          )}

          <button type="submit" className="primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Влизане..." : "Влез"}
          </button>
        </form>

        <p style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
          Нямате акаунт?{" "}
          <Link href="/register" style={{ color: "var(--primary)", fontWeight: "600" }}>
            Регистрирайте се тук
          </Link>
        </p>
      </div>
    </div>
  );
}
