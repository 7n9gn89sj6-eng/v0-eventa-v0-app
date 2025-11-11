import { redirect } from "next/navigation"
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
        <Card>
          <CardHeader>
            <CardTitle>No favorites yet</CardTitle>
            <CardDescription>Start exploring events and bookmark your favorites!</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Discover Events</Link>
            </Button>
          </CardContent>
        </Card>
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
