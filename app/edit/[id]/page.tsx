import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function EditEventPage(props: EditPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const eventId = params.id;
  const token = searchParams.token ?? null;

  if (!eventId || !token) {
    return (
      <div className="p-6 text-red-500">
        Missing edit token.
      </div>
    );
  }

  const isValid = await validateEventEditToken(eventId, token);

  if (!isValid) {
    return (
      <div className="p-6 text-red-500">
        Invalid or expired edit token.
      </div>
    );
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
  });

  if (!event) return notFound();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Edit Event</h1>

      <form
        method="POST"
        action={`/api/events/${eventId}/update`}
        className="space-y-4"
      >
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
            defaultValue={event.description ?? ""}
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
