import { redirect } from 'next/navigation'
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { EventActions } from "@/components/events/event-actions"
import { RegenerateEditLinkButton } from "@/components/events/regenerate-edit-link-button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Suspense } from "react"
import ClientOnly from "@/components/ClientOnly"

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
          <div className="flex items-center justify-center py-16">
            <Card className="max-w-md text-center">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <CardTitle>{"You haven't posted any events yet"}</CardTitle>
                <CardDescription>
                  When you create events, they'll appear here so you can edit and track them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="lg" className="w-full">
                  <Link href="/add-event">Post Your First Event</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
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
                      <span className="font-medium">Start:</span>{" "}
                      <ClientOnly>{new Date(event.startAt).toLocaleDateString()}</ClientOnly>
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
