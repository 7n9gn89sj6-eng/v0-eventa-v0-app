import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface EditPageProps {
  params: { id: string };
  searchParams: { token?: string };
}

export default async function EditEventPage({ params, searchParams }: EditPageProps) {
  const eventId = params.id;
  const token = searchParams.token;

  if (!token) {
    return <div className="p-6 text-red-500">Missing edit token.</div>;
  }

  const valid = await validateEventEditToken(eventId, token);
  if (!valid) {
    return <div className="p-6 text-red-500">Invalid or expired edit token.</div>;
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return notFound();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Edit Event</h1>

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          const form = e.currentTarget;
          const formData = new FormData(form);

          const res = await fetch(`/api/events/${eventId}?token=${token}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: formData.get("title"),
              description: formData.get("description"),
            }),
          });

          if (!res.ok) {
            alert("Failed to save changes");
            return;
          }

          window.location.href = `/events/${eventId}`;
        }}
        className="space-y-4"
      >
        <div>
          <label className="block mb-1 font-medium">Title</label>
          <input
            name="title"
            defaultValue={event.title}
            className="border p-2 w-full rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Description</label>
          <textarea
            name="description"
            defaultValue={event.description ?? ""}
            className="border p-2 w-full rounded"
            rows={4}
          />
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Save Changes
        </button>
      </form>
    </div>
  );
}
