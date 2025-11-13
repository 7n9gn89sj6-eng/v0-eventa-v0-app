"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function EventConfirmPage() {
  const params = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/events/confirm?token=${token}`);
        if (res.ok) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    }

    validateToken();
  }, [token]);

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      {status === "loading" && <h1>Validating your event…</h1>}

      {status === "valid" && (
        <>
          <h1>✔ Event Confirmed</h1>
          <p>Your event has been successfully confirmed.</p>
        </>
      )}

      {status === "invalid" && (
        <>
          <h1>❌ Invalid or expired link</h1>
          <p>Please request a new confirmation email.</p>
        </>
      )}
    </div>
  );
}
