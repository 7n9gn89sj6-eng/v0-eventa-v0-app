import { redirect } from "next/navigation"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { EditEventForm } from "@/components/events/edit-event-form"
import { validateEventEditToken } from "@/lib/eventEditToken"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Lock } from "lucide-react"
import Link from "next/link"

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

  if (token) {
    const validation = await validateEventEditToken(params.id, token)

    if (validation === "ok") {
      isTokenMode = true
    } else if (validation === "expired") {
      tokenValidationError = "This edit link has expired. Please request a new one from the event organizer."
    } else {
      tokenValidationError = "This edit link is invalid. Please check the URL or request a new link."
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

  if (tokenValidationError) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Unable to Edit Event</CardTitle>
              </div>
              <CardDescription>{tokenValidationError}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/events/${params.id}`} className="text-primary hover:underline">
                View event details →
              </Link>
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
