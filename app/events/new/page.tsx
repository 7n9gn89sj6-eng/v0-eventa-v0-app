import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { EventForm } from "@/components/events/event-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Post an Event - Eventa",
  description: "Share your event with the community",
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { title?: string; description?: string; location?: string; date?: string; draftId?: string }
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/signin?callbackUrl=/events/new")
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Post an Event</h1>
        <p className="mt-2 text-muted-foreground">
          {searchParams.draftId
            ? "Review and complete your AI-generated event details"
            : "Share your event with the community. Fill in the details below."}
        </p>
      </div>
      <EventForm initialData={searchParams} draftId={searchParams.draftId} />
    </div>
  )
}
