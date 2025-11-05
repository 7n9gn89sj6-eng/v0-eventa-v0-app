"use client"

import type { Event, User } from "@prisma/client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, MapPin, Globe, DollarSign, ExternalLink, CheckCircle2, Edit } from "lucide-react"
import { DateTime } from "luxon"
import Link from "next/link"
import { useState } from "react"
import { FavoriteButton } from "@/components/events/favorite-button"
import { CalendarExportButton } from "@/components/events/calendar-export-button"

interface EventDetailProps {
  event: Event & {
    createdBy: Pick<User, "name" | "email">
  }
  showSuccessBanner?: boolean
  isFavorited?: boolean
  hasSession?: boolean
}

export function EventDetail({
  event,
  showSuccessBanner = false,
  isFavorited = false,
  hasSession = false,
}: EventDetailProps) {
  const [showBanner, setShowBanner] = useState(showSuccessBanner)

  const startDate = DateTime.fromJSDate(new Date(event.startAt)).setZone(event.timezone)
  const endDate = DateTime.fromJSDate(new Date(event.endAt)).setZone(event.timezone)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/">← Back to events</Link>
        </Button>
      </div>

      {showBanner && (
        <Alert className="mb-6 border-primary/50 bg-primary/5">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="font-medium text-primary">
                Your event is live. We've emailed you an edit link. Save it for later.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/events/${event.id}`}>View event</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/my/events/${event.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit this event
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold tracking-tight text-balance flex-1">{event.title}</h1>
              <div className="flex gap-2 shrink-0">
                {hasSession && <FavoriteButton eventId={event.id} initialIsFavorited={isFavorited} />}
                <CalendarExportButton eventId={event.id} eventTitle={event.title} />
              </div>
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
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{startDate.toLocaleString(DateTime.DATETIME_FULL)}</p>
              <p className="text-sm text-muted-foreground">to {endDate.toLocaleString(DateTime.DATETIME_FULL)}</p>
            </div>
          </div>

          {(event.venueName || event.address) && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                {event.venueName && <p className="font-medium">{event.venueName}</p>}
                {event.address && <p className="text-sm text-muted-foreground">{event.address}</p>}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <DollarSign className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {event.priceFree ? "Free" : `$${((event.priceAmount || 0) / 100).toFixed(2)}`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Languages: {event.languages.join(", ").toUpperCase()}</p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="mb-3 text-xl font-semibold">About this event</h2>
            <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{event.description}</p>
          </div>

          {event.websiteUrl && (
            <div className="border-t pt-6">
              <Button asChild>
                <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer">
                  Visit Website
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
