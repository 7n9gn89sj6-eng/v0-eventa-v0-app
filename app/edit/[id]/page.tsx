import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EditPageProps {
  params: { id: string };
  searchParams?: Record<string, string | string[]>;
}

export default async function EditEventPage({ params, searchParams }: EditPageProps) {
  const eventId = params.id;

  // FIX: searchParams may be undefined OR empty object
  if (!searchParams) {
    return <div className="p-6 text-red-500">Missing edit token.</div>;
  }

  // Try to pull token from ANY possible key
  const token =
    searchParams.token ||
    searchParams.Token ||
    searchParams.TOKEN ||
    Object.keys(searchParams)[0];

  if (!token) {
    return <div className="p-6 text-red-500">Missing edit token.</div>;
  }

  const valid = await validateEventEditToken(eventId, token);
  if (!valid) {
    return <div className="p-6 text-red-500">Invalid or expired edit link.</div>;
  }

  const event = await db.event.findUnique({
    where: { id: eventId }
  });

  if (!event) return notFound();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Edit Event</h1>

      <form method="POST" action={`/api/events/${eventId}/update`} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <div>
          <label className="block mb-1 font-medium">Title</label>
          <input
            name="title"
            defaultValue={event.title}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Description</label>
          <textarea
            name="description"
            defaultValue={event.description || ""}
            className="border p-2 w-full rounded"
            rows={4}
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
