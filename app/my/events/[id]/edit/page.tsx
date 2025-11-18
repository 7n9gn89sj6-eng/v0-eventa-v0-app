import { redirect } from 'next/navigation'
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { EditEventForm } from "@/components/events/edit-event-form"
import { validateEventEditToken } from "@/lib/eventEditToken"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Lock, Clock, Mail } from 'lucide-react'
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { token?: string }
}) {
  const token = searchParams.token
  let isTokenMode = false
  let tokenValidationError: string | null = null
  let isExpired = false

  if (token) {
    const validation = await validateEventEditToken(params.id, token)

    if (validation === "ok") {
      isTokenMode = true
    } else if (validation === "expired") {
      tokenValidationError = "expired"
      isExpired = true
    } else {
      tokenValidationError = "invalid"
    }
  }

  if (!isTokenMode) {
    const session = await getSession()

    if (!session) {
      redirect("/verify")
    }

    const event = await db.event.findUnique({
      where: { id: params.id },
    })

    if (!event) {
      redirect("/my/events")
    }

    if (event.createdById !== session.userId) {
      redirect("/my/events")
    }

    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Edit Event</h1>
            <p className="text-muted-foreground">Update your event details</p>
          </div>
          <EditEventForm event={event} />
        </div>
      </div>
    )
  }

  if (tokenValidationError === "expired") {
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
                  Edit links are valid for 30 days from when they're created to protect your event information.
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
                  <li>Your event still exists and is safe</li>
                  <li>Check your email for a newer edit link</li>
                  <li>Or visit the event page below to request a new link</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <Button asChild variant="default">
                  <Link href={`/events/${params.id}`}>View Event Details</Link>
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

  if (tokenValidationError === "invalid") {
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
                  The link may have been copied incorrectly or may not exist.
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">What to check:</h4>
                <ul className="ml-6 list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Make sure you copied the entire link from your email</li>
                  <li>Check that the link wasn't broken across multiple lines</li>
                  <li>Try clicking the link directly from the email instead of copying</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <Button asChild variant="default">
                  <Link href={`/events/${params.id}`}>View Event Details</Link>
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

  const event = await db.event.findUnique({
    where: { id: params.id },
  })

  if (!event) {
    redirect("/")
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Event</h1>
          <p className="text-muted-foreground">Update your event details</p>
        </div>

        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            You're editing via a secure link.
          </AlertDescription>
        </Alert>

        <EditEventForm event={event} token={token} />
      </div>
    </div>
  )
}
