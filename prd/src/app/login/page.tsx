"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/Toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shakeFields, setShakeFields] = useState<{ email?: boolean; password?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShakeFields({});

    // Basic validation
    let hasError = false;
    const newShakeFields: { email?: boolean; password?: boolean } = {};

    if (!email) {
      newShakeFields.email = true;
      hasError = true;
    }
    if (!password) {
      newShakeFields.password = true;
      hasError = true;
    }

    if (hasError) {
      setShakeFields(newShakeFields);
      setError("Моля, попълнете всички полета");
      setLoading(false);
      return;
    }

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Невалиден имейл или парола");
        setShakeFields({ email: true, password: true });
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

        {registered && !error && (
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

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem" }}>Парола</label>
              <Link href="#" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Забравена парола?</Link>
            </div>
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

      {error && (
        <Toast message={error} onClose={() => setError("")} />
      )}
    </div>
  );
}
