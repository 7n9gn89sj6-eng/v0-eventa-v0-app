import { redirect } from "next/navigation"
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
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; confirmed?: string }>
}) {
  const { id } = await params
  const { token, confirmed } = await searchParams

  if (!token) {
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
                You need a valid edit link to modify this event. Check your email for the edit link that was sent when
                you created the event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/events/${id}`} className="text-primary hover:underline">
                View event details →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const validation = await validateEventEditToken(id, token)

  if (validation === "expired") {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Edit Link Expired</CardTitle>
              </div>
              <CardDescription>
                This edit link has expired. Edit links are valid for 30 days after creation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/events/${id}`} className="text-primary hover:underline">
                View event details →
              </Link>
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
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Invalid Edit Link</CardTitle>
              </div>
              <CardDescription>
                This edit link is invalid. Please check the URL or look for the correct link in your email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/events/${id}`} className="text-primary hover:underline">
                View event details →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const event = await db.event.findUnique({
    where: { id },
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

        {confirmed === "true" && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-900 dark:text-green-100">
              <strong>Success!</strong> Your event has been confirmed and published. You can now edit any details or
              share it with others.
            </AlertDescription>
          </Alert>
        )}

        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            You're editing via a secure link. No sign-in required.
          </AlertDescription>
        </Alert>

        <EditEventForm event={event} token={token} />
      </div>
    </div>
  )
}
