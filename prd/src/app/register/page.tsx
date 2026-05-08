"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/Toast";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shakeFields, setShakeFields] = useState<{ name?: boolean; email?: boolean; password?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShakeFields({});

    // Basic validation
    let hasError = false;
    const newShakeFields: { name?: boolean; email?: boolean; password?: boolean } = {};

    if (!name) { newShakeFields.name = true; hasError = true; }
    if (!email) { newShakeFields.email = true; hasError = true; }
    if (!password) { newShakeFields.password = true; hasError = true; }

    if (hasError) {
      setShakeFields(newShakeFields);
      setError("Моля, попълнете всички полета");
      setLoading(false);
      return;
    }

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
      setShakeFields({ name: true, email: true, password: true });
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

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Пълно име</label>
            <input
              type="text"
              placeholder="Иван Иванов"
              className={shakeFields.name ? "shake" : ""}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (shakeFields.name) setShakeFields(prev => ({ ...prev, name: false }));
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Имейл адрес</label>
            <input
              type="email"
              placeholder="ivan@example.com"
              className={shakeFields.email ? "shake" : ""}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (shakeFields.email) setShakeFields(prev => ({ ...prev, email: false }));
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>Парола</label>
            <input
              type="password"
              placeholder="••••••••"
              className={shakeFields.password ? "shake" : ""}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (shakeFields.password) setShakeFields(prev => ({ ...prev, password: false }));
              }}
            />
          </div>

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

      {error && (
        <Toast message={error} onClose={() => setError("")} />
      )}
    </div>
  );
}
