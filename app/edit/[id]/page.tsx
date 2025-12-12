// app/edit/[id]/page.tsx

import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EditPageProps {
  params: { id: string };
  searchParams?: { token?: string } | null;
}

export default async function EditEventPage({ params, searchParams }: EditPageProps) {
  const eventId = params.id;
  const token =
    (searchParams as Record<string, string> | null | undefined)?.token ?? undefined;

  console.log("[edit] eventId:", eventId);
  console.log("[edit] searchParams:", searchParams);
  console.log("[edit] token from query:", token);

  // 1. Ensure we actually got a token
  if (!token || token.trim() === "") {
    return (
      <div className="p-6 text-red-500">
        Missing edit token. Your link should look like:
        <pre className="mt-2 rounded bg-gray-100 p-2 text-xs">
          /edit/{eventId}?token=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
        </pre>
      </div>
    );
  }

  // 2. Validate the token ("ok" | "invalid" | "expired")
  let status: "ok" | "invalid" | "expired";
  try {
    status = await validateEventEditToken(eventId, token);
    console.log("[edit] token validation status:", status);
  } catch (err) {
    console.error("[edit] TOKEN VALIDATION ERROR:", err);
    return (
      <div className="p-6 text-red-500">
        Internal error while validating your edit link. Please try again later.
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="p-6 text-red-500">
        This edit link is not valid. Please use the latest email you received.
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="p-6 text-red-500">
        This edit link has expired. Request a new one from the event page.
      </div>
    );
  }

  // 3. Load the event
  let event;
  try {
    event = await db.event.findUnique({
      where: { id: eventId },
    });
    console.log("[edit] loaded event:", event && { id: event.id, title: event.title });
  } catch (err) {
    console.error("[edit] PRISMA ERROR:", err);
    return (
      <div className="p-6 text-red-500">
        Failed to load event from the database.
      </div>
    );
  }

  if (!event) {
    return notFound();
  }

  // 4. Render the edit form
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
