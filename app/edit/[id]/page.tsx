import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";
import EditEventForm from "./EditEventForm";
import { logger } from "@/lib/logger";

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

    logger.debug("[edit/page] Loading edit page", { eventId, hasToken: !!token });

    if (!eventId || !token) {
      logger.warn("[edit/page] Missing token or eventId", { eventId, hasToken: !!token });
      return <div className="p-6 text-red-500">Missing edit token.</div>;
    }

    try {
      const isValid = await validateEventEditToken(eventId, token);
      if (!isValid) {
        logger.warn("[edit/page] Invalid token", { eventId });
        return <div className="p-6 text-red-500">Invalid or expired edit token.</div>;
      }
    } catch (tokenError) {
      logger.error("[edit/page] Token validation error", tokenError, { eventId });
      return <div className="p-6 text-red-500">Error validating edit token. Please try again.</div>;
    }

    let event;
    try {
      event = await db.event.findUnique({ 
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          description: true,
        },
      });
    } catch (dbError) {
      logger.error("[edit/page] Database query error", dbError, { eventId });
      return (
        <div className="p-6 text-red-500">
          Error loading event. Please try again.
        </div>
      );
    }
    
    if (!event) {
      logger.warn("[edit/page] Event not found", { eventId });
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
    logger.error("[edit/page] Unexpected error", error);
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="p-6 text-red-500">
          An error occurred while loading the edit page. Please try again.
        </div>
      </div>
    );
  }
}
