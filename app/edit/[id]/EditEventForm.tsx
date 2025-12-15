"use client";

import { useState } from "react";

interface Props {
  event: {
    id: string;
    title: string;
    description: string | null;
  };
  token: string;
}

export default function EditEventForm({ event, token }: Props) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);

    try {
      const res = await fetch(
        `/api/events/${event.id}?token=${encodeURIComponent(token)}`,
        {
          method: "PATCH", // 🔑 must match the API route
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Save failed:", text);
        alert("Save failed");
        return;
      }

      // success → return to event page
      window.location.href = `/events/${event.id}`;
    } catch (err) {
      console.error("Unexpected save error:", err);
      alert("Unexpected error while saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-1 font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />
      </div>

      <div>
        <label className="block mb-1 font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 w-full rounded"
          rows={4}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
