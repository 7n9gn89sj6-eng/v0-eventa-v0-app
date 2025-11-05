import { validateTokenAndGetEvent } from "./actions"
import { EventEditForm } from "@/components/event-edit-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface PageProps {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function EditEventPage({ params, searchParams }: PageProps) {
  const { eventId } = await params
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Edit Link Required</AlertTitle>
          <AlertDescription>
            You need a valid edit link to modify this event. Check your email for the edit link that was sent when you
            created the event.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const result = await validateTokenAndGetEvent(eventId, token)

  if (result.error || !result.event) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Edit Link</AlertTitle>
          <AlertDescription>{result.error || "This edit link is invalid or has expired."}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Edit Event</h1>
          <p className="text-muted-foreground">Make changes to your event using this secure edit link</p>
        </div>

        <EventEditForm eventId={eventId} token={token} initialData={result.event} />

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>This edit link will expire 30 days after creation. Keep this email safe to make future changes.</p>
        </div>
      </div>
    </div>
  )
}
