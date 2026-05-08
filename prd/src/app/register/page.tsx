"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: "100vh" }}>
      <div className="auth-card glass">
        <h1 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", textAlign: "center" }}>Регистрация</h1>
        <p style={{ marginBottom: "2rem", color: "var(--muted-foreground)", textAlign: "center", fontSize: "0.9rem" }}>
          Създайте своя акаунт, за да започнете
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Пълно име</label>
            <input
              type="text"
              placeholder="Иван Иванов"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Парола</label>
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
            {loading ? "Създаване..." : "Регистрирай се"}
          </button>
        </form>

        <p style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
          Вече имате акаунт?{" "}
          <Link href="/login" style={{ color: "var(--primary)", fontWeight: "600" }}>
            Влезте тук
          </Link>
        </p>
      </div>
    </div>
  );
}
