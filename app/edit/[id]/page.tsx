import { redirect } from "next/navigation"
import db from "@/lib/db"                         // << FIXED HERE
import { EditEventForm } from "@/components/events/edit-event-form"
import { validateEventEditToken } from "@/lib/eventEditToken"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  const id = params.id
  const token = searchParams?.token
  const confirmed = searchParams?.confirmed
  const isConfirmedAccess = confirmed === "true"

  /* ---------------------------------------------
      1. No token + not confirmed → show warning
  --------------------------------------------- */
  if (!token && !isConfirmedAccess) {
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
                You need a valid edit link to modify this event. Check your email
                for the edit link that was sent when you created the event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/events/${id}`}
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

  /* ---------------------------------------------
      2. Token provided → validate it
  --------------------------------------------- */
  if (token && !isConfirmedAccess) {
    const validation = await validateEventEditToken(id, token)

    if (validation === "expired") {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card className="border-amber-200 dark:border-amber-900">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <CardTitle>Edit Link Expired</CardTitle>
                </div>
                <CardDescription className="space-y-2 text-base">
                  <p>This edit link has expired for security reasons.</p>
                  <p className="text-sm text-muted-foreground">
                    Edit links are valid for 30 days from creation.
                  </p>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="mb-2 flex items-center gap-2 font-medium">
                    <Mail className="h-4 w-4" />
                    What to do next:
                  </h4>
                  <ul className="ml-6 list-disc space-y-1 text-sm text-muted-foreground">
                    <li>Your event still exists</li>
                    <li>Check your email for a newer edit link</li>
                    <li>
                      Or visit the event page below to request a new edit link
                    </li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button asChild variant="default">
                    <Link href={`/events/${id}`}>View Event Details</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/">Back to Home</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    if (validation === "invalid") {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <CardTitle>Invalid Edit Link</CardTitle>
                </div>
                <CardDescription className="space-y-2 text-base">
                  <p>This edit link is not valid.</p>
                  <p className="text-sm text-muted-foreground">
                    It may have been copied incorrectly or may not exist.
                  </p>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="mb-2 font-medium">What to check:</h4>
                  <ul className="ml-6 list-disc space-y-1 text-sm text-muted-foreground">
                    <li>Copy link fully from email</li>
                    <li>Ensure link was not broken across two lines</li>
                    <li>Click link directly from the email</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button asChild variant="default">
                    <Link href={`/events/${id}`}>View Event Details</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/">Back to Home</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  }

  /* ---------------------------------------------
      3. Load event
  --------------------------------------------- */
  const event = await db.event.findUnique({
    where: { id },
  })

  if (!event) {
    redirect("/")
  }

  /* ---------------------------------------------
      4. Render edit form
  --------------------------------------------- */
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Event</h1>
          <p className="text-muted-foreground">Update your event details</p>
        </div>

        {isConfirmedAccess && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-900 dark:text-green-100">
              <strong>Success!</strong> Your event has been confirmed and
              published.
            </AlertDescription>
          </Alert>
        )}

        {token && !isConfirmedAccess && (
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
            <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              You're editing via a secure link. No sign-in required.
            </AlertDescription>
