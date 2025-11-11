"use client"

import type { SearchResult } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, ExternalLink } from "lucide-react"
import { DateTime } from "luxon"
import Link from "next/link"
import ClientOnly from "@/components/ClientOnly"

interface ResultCardProps {
  result: SearchResult
}

export function ResultCard({ result }: ResultCardProps) {
  const startDate = DateTime.fromISO(result.startAt)
  const isEventa = result.source === "eventa"

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={isEventa ? "default" : "secondary"}>Source: {isEventa ? "Eventa" : "Web"}</Badge>
              {result.priceFree && <Badge variant="outline">Free</Badge>}
            </div>
            <h3 className="text-xl font-semibold leading-tight text-balance">
              {isEventa && result.id ? (
                <Link href={result.url!} className="hover:underline">
                  {result.title}
                </Link>
              ) : (
                result.title
              )}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Date */}
        <div className="flex items-start gap-2 text-sm">
          <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <ClientOnly
            placeholder={
              <div>
                <p className="font-medium">—</p>
                <p className="text-muted-foreground">—</p>
              </div>
            }
          >
            <div>
              <p className="font-medium">{startDate.toLocaleString(DateTime.DATE_FULL)}</p>
              <p className="text-muted-foreground">{startDate.toLocaleString(DateTime.TIME_SIMPLE)}</p>
            </div>
          </ClientOnly>
        </div>

        {/* Location */}
        {(result.venue || result.address) && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              {result.venue && <p className="font-medium">{result.venue}</p>}
              {result.address && <p className="text-muted-foreground">{result.address}</p>}
              {result.distanceKm !== undefined && (
                <p className="text-xs text-muted-foreground">{result.distanceKm} km away</p>
              )}
            </div>
          </div>
        )}

        {/* Categories */}
        {result.categories && result.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.categories.slice(0, 4).map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
        )}

        {/* Snippet */}
        {result.snippet && <p className="text-sm text-muted-foreground line-clamp-2">{result.snippet}</p>}

        {/* CTA */}
        <div className="pt-2">
          {isEventa && result.id ? (
            <Button asChild variant="default" size="sm">
              <Link href={result.url!}>View Details</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                Open Link
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
