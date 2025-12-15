"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EditEventForm({ event, token }: any) {
  const router = useRouter();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    const res = await fetch(`/api/events/${event.id}?token=${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    if (!res.ok) {
      alert("Save failed");
      setSaving(false);
      return;
    }

    router.push(`/events/${event.id}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-1 font-medium">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 w-full rounded"
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
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
