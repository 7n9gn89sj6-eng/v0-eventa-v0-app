import { redirect } from 'next/navigation'
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { FavoriteButton } from "@/components/events/favorite-button"
import ClientOnly from "@/components/ClientOnly"

export const dynamic = "force-dynamic"

export default async function FavoritesPage() {
  const session = await getSession()

  if (!session) {
    redirect("/verify")
  }

  const favorites = await db.favorite.findMany({
    where: { userId: session.userId },
    include: {
      event: {
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Favorites</h1>
        <p className="text-muted-foreground">Events you've bookmarked</p>
      </div>

      {favorites.length === 0 ? (
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
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <CardTitle>No favorite events yet</CardTitle>
              <CardDescription>
                Tap the heart on events you like, and they'll show up here for easy access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild size="lg" className="w-full">
                <Link href="/events">Browse Events</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/">Search Events</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map(({ event }) => (
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
                  <FavoriteButton eventId={event.id} initialIsFavorited={true} />
                </div>
                <CardTitle className="line-clamp-2">
                  <Link href={`/events/${event.id}`} className="hover:underline">
                    {event.title}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2">{event.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Location:</span> {event.city}, {event.country}
                  </p>
                  <p>
                    <span className="font-medium">Start:</span>{" "}
                    <ClientOnly>{new Date(event.startAt).toLocaleDateString()}</ClientOnly>
                  </p>
                  <Button asChild className="w-full mt-4">
                    <Link href={`/events/${event.id}`}>View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
