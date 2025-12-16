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
  let params: { id: string };
  let searchParams: { token?: string };
  let eventId: string;
  let token: string | null;

  try {
    params = await props.params;
    searchParams = await props.searchParams;
    eventId = params.id;
    token = searchParams.token ?? null;
  } catch (error) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="p-6 text-red-500">Error loading page parameters.</div>
      </div>
    );
  }

  if (!eventId || !token) {
    return <div className="p-6 text-red-500">Missing edit token.</div>;
  }

  let isValid: boolean;
  try {
    isValid = await validateEventEditToken(eventId, token);
  } catch (error) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="p-6 text-red-500">Error validating edit token. Please try again.</div>
      </div>
    );
  }

  if (!isValid) {
    return <div className="p-6 text-red-500">Invalid or expired edit token.</div>;
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
  } catch (error) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="p-6 text-red-500">Error loading event. Please try again.</div>
      </div>
    );
  }
  
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
}
