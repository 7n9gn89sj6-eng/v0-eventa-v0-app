import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { EditEventForm } from "@/components/events/edit-event-form"
import { validateEventEditToken } from "@/lib/eventEditToken"

export default async function EditEventPage({ params, searchParams }) {
  const eventId = params.id
  const token = searchParams?.token

  // If no token, block access
  if (!token) {
    redirect(`/events/${eventId}`)
  }

  // Validate token
  const status = await validateEventEditToken(eventId, token)

  if (status !== "valid") {
    redirect(`/events/${eventId}`)
  }

  // Load event
  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) redirect("/")

  // Render form
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Edit Event</h1>
      <EditEventForm event={event} token={token} />
    </div>
  )
}
