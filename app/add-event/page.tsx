import { AddEventForm } from "@/components/events/add-event-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Add an Event - Eventa",
  description: "Share your event with the community",
}

export default function AddEventPage({
  searchParams,
}: {
  searchParams: { title?: string; description?: string; location?: string; date?: string }
}) {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-balance">Add an Event</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          Share your event with the community. Fill in the details below and we'll send you a verification email to
          finish publishing.
        </p>
      </div>
      <AddEventForm initialData={searchParams} />
    </div>
  )
}
