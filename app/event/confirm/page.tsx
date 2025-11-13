"use client";

import { useEffect, useState } from "react";

export default function EventConfirmPage() {
  const [status, setStatus] = useState<"loading"|"ok"|"error">("loading");
  const [message, setMessage] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Missing or invalid confirmation link.");
      return;
    }

    async function confirm() {
      try {
        const res = await fetch(`/api/events/confirm?token=${token}`);
        const data = await res.json();

        if (!data.ok) {
          setStatus("error");
          setMessage(data.error || "Confirmation failed.");
        } else {
          setEventId(data.eventId);
          setStatus("ok");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Server error while confirming event.");
      }
    }

    confirm();
  }, []);

  if (status === "loading") {
    return <div className="p-8 text-center">Confirming your event…</div>;
  }

  if (status === "error") {
    return (
      <div className="p-8 text-center text-red-600">
        <h1 className="text-xl font-semibold mb-2">Confirmation Failed</h1>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Event Confirmed</h1>
      <p className="mb-6">Your event is now published.</p>

      {eventId && (
        <a
          href={`/edit/${eventId}`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Edit your event
        </a>
      )}
    </div>
  );
}
