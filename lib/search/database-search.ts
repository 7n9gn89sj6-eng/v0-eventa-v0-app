import { db } from "@/lib/db"
import type { SearchResult, SearchFilters } from "@/lib/types"
import { DateTime } from "luxon"
import { foldAccents } from "@/lib/search/accent-fold"

export interface DatabaseSearchOptions {
  query: string
  synonyms: string[]
  categories: string[]
  filters?: SearchFilters
  userLat?: number
  userLng?: number
  limit?: number
}

export async function searchDatabase(options: DatabaseSearchOptions): Promise<SearchResult[]> {
  const { query, synonyms, categories, filters, userLat, userLng, limit = 20 } = options

  const searchTerms = [query, ...synonyms].filter(Boolean).join(" | ")
  const searchTermsFolded = foldAccents(searchTerms)

  const now = new Date()
  const baseDate = {
    gte: now
  }

  const events = await db.$queryRaw<any[]>`
    SELECT 
      e.*,
      GREATEST(
        ts_rank(to_tsvector('simple', e.search_text), plainto_tsquery('simple', ${searchTerms})),
        ts_rank(to_tsvector('simple', COALESCE(e.search_text_folded, '')), plainto_tsquery('simple', ${searchTermsFolded}))
      ) AS rank,
      CASE 
        WHEN ${userLat}::float IS NOT NULL 
         AND ${userLng}::float IS NOT NULL
         AND e.lat IS NOT NULL 
         AND e.lng IS NOT NULL
        THEN (
          6371 * acos(
            cos(radians(${userLat}::float)) * cos(radians(e.lat)) *
            cos(radians(e.lng) - radians(${userLng}::float)) +
            sin(radians(${userLat}::float)) * sin(radians(e.lat))
          )
        )
        ELSE NULL
      END AS distance_km
    FROM "Event" e
    WHERE 
      e.start_at >= ${baseDate.gte}
      AND (
        to_tsvector('simple', e.search_text) @@ plainto_tsquery('simple', ${searchTerms})
        OR to_tsvector('simple', COALESCE(e.search_text_folded, '')) @@ plainto_tsquery('simple', ${searchTermsFolded})
      )
    ORDER BY 
      rank DESC,
      COALESCE(distance_km, 999999) ASC,
      e.start_at ASC
    LIMIT ${limit};
  `

  return events.map((event) => ({
    source: "eventa" as const,
    id: event.id,
    title: event.title,
    startAt: event.start_at.toISOString(),
    endAt: event.end_at.toISOString(),
    venue: event.venue_name,
    address: event.address,
    lat: event.lat,
    lng: event.lng,
    url: `/events/${event.id}`,
    snippet: event.description?.slice(0, 200) + "...",
    distanceKm: event.distance_km ? Math.round(event.distance_km * 10) / 10 : undefined,
    categories: event.categories,
    priceFree: event.price_free,
    imageUrl: event.image_urls?.[0],
  }))
}
