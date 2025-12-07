"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }

    // Redirect to admin dashboard
    window.location.href = "/admin";
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>Admin Login</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, fontSize: 16 }}
        />

        <input
          type="password"
          placeholder="Admin Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, fontSize: 16 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 16px",
            fontSize: 16,
            cursor: "pointer",
            background: "black",
            color: "white",
            border: "none",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {error && (
          <div style={{ color: "red", marginTop: 10, textAlign: "center" }}>{error}</div>
        )}
      </form>
    </div>
  );
}
