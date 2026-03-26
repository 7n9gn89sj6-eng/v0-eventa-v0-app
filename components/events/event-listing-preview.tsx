"use client"

import { Calendar, ExternalLink, MapPin } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { isPublicHttpUrl } from "@/lib/events/public-http-url"
import { cn } from "@/lib/utils"

export type EventListingPreviewProps = {
  title: string
  description: string
  imageUrl?: string
  /** `datetime-local` value or ISO string */
  startAt: string
  endAt: string
  /** Single line for place (e.g. address, city, country) */
  locationLine: string
  /** Short label shown as a badge */
  categoryLabel?: string
  externalUrl?: string
  className?: string
}

function formatRangeLabel(startAt: string, endAt: string): string {
  const s = startAt ? new Date(startAt) : null
  const e = endAt ? new Date(endAt) : null
  if (!s || Number.isNaN(s.getTime())) return "—"
  const sStr = s.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  if (!e || Number.isNaN(e.getTime())) return sStr
  const sameDay = s.toDateString() === e.toDateString()
  const eStr = sameDay
    ? e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : e.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
  return sameDay ? `${sStr} – ${eStr}` : `${sStr} – ${eStr}`
}

export function EventListingPreview({
  title,
  description,
  imageUrl = "",
  startAt,
  endAt,
  locationLine,
  categoryLabel,
  externalUrl,
  className,
}: EventListingPreviewProps) {
  const trimmedUrl = imageUrl.trim()
  const showImage = trimmedUrl && isPublicHttpUrl(trimmedUrl)
  const excerpt = description.trim() || "—"
  const place = locationLine.trim() || "—"

  return (
    <Card
      className={cn("flex flex-col overflow-hidden border-dashed border-muted-foreground/40 shadow-sm", className)}
      aria-label="How your event may appear in listings"
    >
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={trimmedUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No poster yet — add an image to see it here
          </div>
        )}
      </div>

      <CardHeader className="flex-1 space-y-2 pb-2">
        {categoryLabel ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs font-normal">
              {categoryLabel}
            </Badge>
          </div>
        ) : null}

        <CardTitle className="line-clamp-2 text-balance leading-tight">
          {title.trim() || "Event title"}
        </CardTitle>

        <CardDescription className="line-clamp-3 text-pretty">{excerpt}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="text-foreground">{formatRangeLabel(startAt, endAt)}</span>
        </div>

        <div className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className={place === "—" ? "text-muted-foreground" : "text-foreground"}>{place}</span>
        </div>

        {externalUrl?.trim() && isPublicHttpUrl(externalUrl) ? (
          <div className="flex items-center gap-2 pt-1">
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-xs text-muted-foreground">Link will show on your listing like in search results</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
