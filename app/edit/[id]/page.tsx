import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";
import EditEventForm from "./EditEventForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function EditEventPage(props: EditPageProps) {
  try {
    const params = await props.params;
    const searchParams = await props.searchParams;

    const eventId = params.id;
    const token = searchParams.token ?? null;

    if (!eventId || !token) {
      return <div className="p-6 text-red-500">Missing edit token.</div>;
    }

    const isValid = await validateEventEditToken(eventId, token);
    if (!isValid) {
      return <div className="p-6 text-red-500">Invalid or expired edit token.</div>;
    }

    const event = await db.event.findUnique({ 
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        description: true,
      },
    });
    
    if (!event) {
      return notFound();
    }

    // Ensure description is serializable (can be null)
    const serializableEvent = {
      id: event.id,
      title: event.title,
      description: event.description ?? null,
    };

    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-6">Edit Event</h1>
        <EditEventForm event={serializableEvent} token={token} />
      </div>
    );
  } catch (error) {
    // Log error for debugging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.error("[edit/page] Error:", error);
    }
    // Re-throw to let Next.js error boundary handle it
    throw error;
  }
}
