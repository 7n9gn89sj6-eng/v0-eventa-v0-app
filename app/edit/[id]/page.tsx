// app/edit/[id]/page.tsx
import { redirect } from "next/navigation"
import db from "@/lib/db"
import { EditEventForm } from "@/components/events/edit-event-form"
import { validateEventEditToken } from "@/lib/eventEditToken"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Lock, Clock, Mail } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

interface EditEventPageProps {
  params: { id: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function EditEventPage({ params, searchParams }: EditEventPageProps) {
  const eventId = params.id

  // ---------------------------
  // Normalize search params
  // ---------------------------
  const tokenRaw = searchParams?.token
  const confirmedRaw = searchParams?.confirmed

  const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw
  const confirmed = Array.isArray(confirmedRaw)
    ? confirmedRaw[0] === "true"
    : confirmedRaw === "true"

  // OPTIONAL DEBUG (uncomment if needed)
  // console.log("[edit] params:", params)
  // console.log("[edit] searchParams:", searchParams)
  // console.log("[edit] token:", token)
  // console.log("[edit] confirmed:", confirmed)

  /* ------------------------------------------------------
     CASE 1 — No token and not confirmed → Block access
  ------------------------------------------------------- */
  if (!token && !confirmed) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Edit Link Required</CardTitle>
              </div>
              <CardDescription>
                You need a valid edit link to modify this event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/events/${eventId}`}
                className="text-primary hover:underline"
              >
                View event details →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------
     CASE 2 — Token provided → Validate it
  ------------------------------------------------------- */
  if (token && !confirmed) {
    const result = await validateEventEditToken(eventId, token)

    if (result === "expired") {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card className="border-amber-300">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <CardTitle>Edit Link Expired</CardTitle>
                </div>
                <CardDescription>
                  This edit link has expired. Edit links are valid for 30 days.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4" /> What to do next:
                  </p>
                  <ul className="list-disc ml-6 text-sm text-muted-foreground space-y-1">
                    <li>The event still exists</li>
                    <li>Check your email for the newest edit link</li>
                    <li>You can request a new link on the event page</li>
                  </ul>
                </div>
                <Button asChild>
                  <Link href={`/events/${eventId}`}>View Event</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    if (result === "invalid") {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <CardTitle>Invalid Edit Link</CardTitle>
                </div>
                <CardDescription>
                  This edit link is invalid or incomplete.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={`/events/${eventId}`}>View Event</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    // Only "valid" continues
  }

  /* ------------------------------------------------------
     CASE 3 — Token valid OR confirmed → Load event
  ------------------------------------------------------- */
  const event = await db.event.findUnique({
    where: { id: eventId },
  })

  if (!event) redirect("/")

  /* ------------------------------------------------------
     Render edit form
  ------------------------------------------------------- */
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold mb-3">Edit Event</h1>
        <p className="text-muted-foreground mb-8">Update your event details.</p>

        {confirmed && (
          <Alert className="mb-6 border-green-300 bg-green-50">
            <AlertDescription>
              <strong>Success!</strong> Your event is confirmed and published.
            </AlertDescription>
          </Alert>
        )}

        {token && !confirmed && (
          <Alert className="mb-6 border-blue-300 bg-blue-50">
            <Lock className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              You're editing via a secure link. No sign-in required.
            </AlertDescription>
          </Alert>
        )}

        <EditEventForm event={event} token={token || ""} />
      </div>
    </div>
  )
}
