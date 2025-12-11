import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EditPageProps {
  params: { id: string };
}

export default async function EditEventPage({ params }: EditPageProps) {
  const eventId = params.id;

  // ----------------------------
  // 1. Extract token properly on Render
  // ----------------------------
  const h = headers();
  const orig = h.get("x-original-url");
  const referer = h.get("referer");

  const rawUrl =
    orig ||
    referer ||
    ""; // final fallback

  // Local fake base because URL requires absolute URL
  const url = new URL(rawUrl, "https://example.com");

  const token =
    url.searchParams.get("token") ||
    url.searchParams.get("Token") ||
    url.searchParams.get("TOKEN");

  console.log("[edit] EVENT ID:", eventId);
  console.log("[edit] RAW URL:", rawUrl);
  console.log("[edit] TOKEN EXTRACTED:", token);

  if (!token) {
    return (
      <div className="p-6 text-red-500">
        Missing edit token (server did not receive ?token=...).
      </div>
    );
  }

  // ----------------------------
  // 2. Validate token
  // ----------------------------
  let valid;
  try {
    valid = await validateEventEditToken(eventId, token);
    console.log("[edit] TOKEN VALID?", valid);
  } catch (err: any) {
    console.error("[edit] TOKEN VALIDATION ERROR:", err);
    return (
      <div className="p-6 text-red-500">
        Internal error while validating edit token.
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="p-6 text-red-500">
        Invalid or expired edit token.
      </div>
    );
  }

  // ----------------------------
  // 3. Load event from DB
  // ----------------------------
  let event;
  try {
    event = await db.event.findUnique({
      where: { id: eventId }
    });

    console.log("[edit] EVENT LOADED:", event);
  } catch (err: any) {
    console.error("[edit] PRISMA ERROR:", err);
    return (
      <div className="p-6 text-red-500">
        Failed to load event. Database error.
      </div>
    );
  }

  if (!event) return notFound();

  // ----------------------------
  // 4. Render form
  // ----------------------------
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
