import { redirect } from "next/navigation"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { EventActions } from "@/components/events/event-actions"
import { RegenerateEditLinkButton } from "@/components/events/regenerate-edit-link-button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function MyEventsPage() {
  const session = await getSession()

  if (!session) {
    redirect("/verify")
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      isAdmin: true,
      events: {
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!user) {
    redirect("/verify")
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Events</h1>
          <p className="text-muted-foreground">Manage your submitted events</p>
        </div>
        <Button asChild>
          <Link href="/add-event">Add New Event</Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSpinner size="lg" className="py-12" />}>
        {user.events.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No events yet</CardTitle>
              <CardDescription>
                {"You haven't submitted any events. Create your first event to get started!"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/add-event">Add Your First Event</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {user.events.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        event.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <CardTitle className="line-clamp-2">
                    <Link href={`/my/events/${event.id}`} className="hover:underline">
                      {event.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Owner:</span>
                      <span className="truncate">{event.createdBy.name || event.createdBy.email.split("@")[0]}</span>
                    </div>
                    <p>
                      <span className="font-medium">Location:</span> {event.city}, {event.country}
                    </p>
                    <p>
                      <span className="font-medium">Start:</span> {new Date(event.startAt).toLocaleDateString()}
                    </p>
                    <EventActions eventId={event.id} status={event.status} />
                    {user.isAdmin && (
                      <div className="mt-3 pt-3 border-t">
                        <RegenerateEditLinkButton eventId={event.id} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Suspense>
    </div>
  )
}
