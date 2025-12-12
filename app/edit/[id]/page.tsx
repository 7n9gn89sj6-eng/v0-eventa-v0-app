import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditEventPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { token?: string };
}) {
  const eventId = params.id;
  const token = searchParams?.token;

  console.log("[edit] EVENT ID:", eventId);
  console.log("[edit] TOKEN:", token);

  if (!token) {
    return (
      <div className="p-6 text-red-500">
        Missing ?token=... parameter in URL.
      </div>
    );
  }

  const result = await validateEventEditToken(eventId, token);

  if (result !== "ok") {
    return (
      <div className="p-6 text-red-500">
        Invalid or expired edit token.
      </div>
    );
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return notFound();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Edit Event</h1>

      <form method="POST" action={`/api/events/${eventId}/update`}>
        <input type="hidden" name="token" value={token} />

        <label className="block mb-1 font-medium">Title</label>
        <input
          name="title"
          defaultValue={event.title}
          className="border p-2 w-full rounded mb-4"
        />

        <label className="block mb-1 font-medium">Description</label>
        <textarea
          name="description"
          defaultValue={event.description || ""}
          className="border p-2 w-full rounded mb-4"
          rows={4}
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Save Changes
        </button>
      </form>
    </div>
  );
}

