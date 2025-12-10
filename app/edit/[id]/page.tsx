import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { EditEventForm } from "@/components/events/edit-event-form"
import { validateEventEditToken } from "@/lib/eventEditToken"

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent
} from "@/components/ui/card"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Lock, Clock, Mail } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { token?: string; confirmed?: string }
}) {
  const eventId = params.id
  const token = searchParams?.token
  const confirmed = searchParams?.confirmed === "true"

  // ---------------- DEBUG LOGS ----------------
  console.log("[EDIT DEBUG] Incoming request:", {
    eventId,
    token,
    confirmed,
    urlSearchParams: searchParams
  })
  // --------------------------------------------

  /* ------------------------------------------------------
     CASE 1 — No token and not confirmed: block access
  ------------------------------------------------------- */
  if (!token && !confirmed) {
    console.log("[EDIT DEBUG] No token + not confirmed → blocking access")
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
              <Link href={`/events/${eventId}`} className="text-primary hover:underline">
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
    console.log("[EDIT DEBUG] Validating token:", token)

    const result = await validateEventEditToken(eventId, token)

    console.log("[EDIT DEBUG] Token validation result:", result)

    if (result === "expired") {
      console.log("[EDIT DEBUG] Token expired")
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
                  This edit link has expired.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )
    }

    if (result === "invalid") {
      console.log("[EDIT DEBUG] Token INVALID → likely DB mismatch")
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
            </Card>
          </div>
        </div>
      )
    }
  }

  /* ------------------------------------------------------
     CASE 3 — Token valid or confirmed → Load event
  ------------------------------------------------------- */
  console.log("[EDIT DEBUG] Loading event:", eventId)

  const event = await db.event.findUnique({ where: { id: eventId } })

  console.log("[EDIT DEBUG] Loaded event:", event ? "FOUND" : "NOT FOUND")

  if (!event) {
    console.log("[EDIT DEBUG] Event not found → redirect")
    redirect("/")
  }

  /* ------------------------------------------------------
     RENDER EDIT FORM
  ------------------------------------------------------- */
  console.log("[EDIT DEBUG] Rendering edit form")

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold mb-3">Edit Event</h1>

        {token && !confirmed && (
          <Alert className="mb-6 border-blue-300 bg-blue-50">
            <Lock className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              You're editing via a secure link.
            </AlertDescription>
          </Alert>
        )}

        <EditEventForm event={event} token={token || ""} />
      </div>
    </div>
  )
}
