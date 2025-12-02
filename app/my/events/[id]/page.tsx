import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/jwt"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Globe, DollarSign, UserIcon, Edit } from "lucide-react"
import { DateTime } from "luxon"
import Link from "next/link"
import { EventActions } from "@/components/events/event-actions"
import { RegenerateEditLinkButton } from "@/components/events/regenerate-edit-link-button"
import ClientOnly from "@/components/ClientOnly"

export const dynamic = "force-dynamic"

export default async function MyEventDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()

  if (!session) {
    redirect("/verify")
  }

  const { id } = params

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
        },
      },
    },
  })

  if (!event) {
    notFound()
  }

  // Check if user is owner or admin
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  })

  const isOwner = event.createdById === session.userId
  const isAdmin = user?.isAdmin || false

  if (!isOwner && !isAdmin) {
    redirect(`/events/${id}`)
  }

  const startDate = DateTime.fromJSDate(new Date(event.startAt)).setZone(event.timezone)
  const endDate = DateTime.fromJSDate(new Date(event.endAt)).setZone(event.timezone)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/my/events">← Back to my events</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/events/${event.id}`}>View Public Page</Link>
          </Button>
          <Button asChild>
            <Link href={`/my/events/${event.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Event
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-3xl">{event.title}</CardTitle>
              <Badge
                variant={event.status === "PUBLISHED" ? "default" : event.status === "DRAFT" ? "secondary" : "outline"}
              >
                {event.status}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {event.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Owner</p>
                <p className="font-medium">{event.createdBy.name || event.createdBy.email}</p>
                {event.createdBy.name && <p className="text-sm text-muted-foreground">{event.createdBy.email}</p>}
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <ClientOnly>
                <p className="font-medium">{startDate.toLocaleString(DateTime.DATETIME_FULL)}</p>
                <p className="text-sm text-muted-foreground">to {endDate.toLocaleString(DateTime.DATETIME_FULL)}</p>
              </ClientOnly>
            </div>
          </div>

          {/* Location */}
          {(event.venueName || event.address) && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                {event.venueName && <p className="font-medium">{event.venueName}</p>}
                {event.address && <p className="text-sm text-muted-foreground">{event.address}</p>}
              </div>
            </div>
          )}

          {/* Price */}
          <div className="flex items-start gap-3">
            <DollarSign className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {event.priceFree ? "Free" : `$${((event.priceAmount || 0) / 100).toFixed(2)}`}
              </p>
            </div>
          </div>

          {/* Languages */}
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Languages: {event.languages.join(", ").toUpperCase()}</p>
            </div>
          </div>

          {/* Description */}
          <div className="border-t pt-6">
            <h2 className="mb-3 text-xl font-semibold">About this event</h2>
            <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{event.description}</p>
          </div>

          {/* Actions */}
          <div className="border-t pt-6 space-y-3">
            <EventActions eventId={event.id} status={event.status} />
            {isAdmin && (
              <div className="pt-3 border-t">
                <RegenerateEditLinkButton eventId={event.id} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
