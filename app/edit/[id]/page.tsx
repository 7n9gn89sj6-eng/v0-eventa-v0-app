import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EditPageProps {
  params: { id: string };
}

export default async function EditEventPage({ params }: EditPageProps) {
  const eventId = params.id;

  /* ------------------------------------------------------------ */
  /*  1. Extract token — Render strips query params from pathname  */
  /* ------------------------------------------------------------ */
  const h = headers();

  const orig = h.get("x-original-url");     // Render's internal rewrite
  const referer = h.get("referer");         // Sometimes the only source

  const rawUrl = orig || referer || "";

  let token: string | null = null;

  try {
    // Must provide full URL because rawUrl is a path only
    const url = new URL(rawUrl, "https://example.com");
    token =
      url.searchParams.get("token") ||
      url.searchParams.get("Token") ||
      url.searchParams.get("TOKEN") ||
      null;
  } catch (err) {
    console.error("[edit] URL PARSE ERROR:", err);
  }

  console.log("[edit] EVENT ID:", eventId);
  console.log("[edit] RAW URL:", rawUrl);
  console.log("[edit] TOKEN:", token);

  if (!token) {
    return (
      <div className="p-6 text-red-600">
        Missing edit token.  
        <br />
        The server did not receive <code>?token=...</code>.
      </div>
    );
  }

  /* ------------------------------------------------------------ */
  /*  2. Validate token                                           */
  /* ------------------------------------------------------------ */
  let isValid = false;

  try {
    const result = await validateEventEditToken(eventId, token);
    isValid = result === "ok";
    console.log("[edit] TOKEN VALIDATION RESULT:", result);
  } catch (err) {
    console.error("[edit] TOKEN VALIDATION ERROR:", err);
    return (
      <div className="p-6 text-red-600">
        Internal error during token validation.
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="p-6 text-red-600">
        Invalid or expired edit token.
      </div>
    );
  }

  /* ------------------------------------------------------------ */
  /*  3. Load event                                               */
  /* ------------------------------------------------------------ */
  let event;

  try {
    event = await db.event.findUnique({
      where: { id: eventId },
    });
    console.log("[edit] EVENT LOADED:", event);
  } catch (err) {
    console.error("[edit] PRISMA ERROR:", err);
    return (
      <div className="p-6 text-red-600">
        Failed to load event from database.
      </div>
    );
  }

  if (!event) return notFound();

  /* ------------------------------------------------------------ */
  /*  4. Render UI                                                */
  /* ------------------------------------------------------------ */
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
