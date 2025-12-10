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

  // Build where clause
  const where: any = {
    startAt: {
      gte: new Date(),
    },
  }

  // Date range filter
  if (filters?.dateRange) {
    const now = DateTime.now()
    switch (filters.dateRange) {
      case "today":
        where.startAt = {
          gte: now.startOf("day").toJSDate(),
          lte: now.endOf("day").toJSDate(),
        }
        break
      case "weekend":
        const nextSaturday = now.plus({ days: (6 - now.weekday) % 7 })
        where.startAt = {
          gte: nextSaturday.startOf("day").toJSDate(),
          lte: nextSaturday.plus({ days: 1 }).endOf("day").toJSDate(),
        }
        break
      case "month":
        where.startAt = {
          gte: now.startOf("day").toJSDate(),
          lte: now.plus({ months: 1 }).toJSDate(),
        }
        break
    }
  }

  // Category filter
  if (filters?.categories && filters.categories.length > 0) {
    where.categories = {
      hasSome: filters.categories,
    }
  } else if (categories.length > 0) {
    where.categories = {
      hasSome: categories,
    }
  }

  // Price filter
  if (filters?.free) {
    where.priceFree = true
  }

  const events = await prisma.$queryRaw<any[]>`
    SELECT 
      e.*,
      GREATEST(
        ts_rank(to_tsvector('simple', e.search_text), plainto_tsquery('simple', ${searchTerms})),
        ts_rank(to_tsvector('simple', COALESCE(e.search_text_folded, '')), plainto_tsquery('simple', ${searchTermsFolded}))
      ) as rank,
      CASE 
        WHEN ${userLat}::float IS NOT NULL AND ${userLng}::float IS NOT NULL AND e.lat IS NOT NULL AND e.lng IS NOT NULL
        THEN (
          6371 * acos(
            cos(radians(${userLat}::float)) * cos(radians(e.lat)) *
            cos(radians(e.lng) - radians(${userLng}::float)) +
            sin(radians(${userLat}::float)) * sin(radians(e.lat))
          )
        )
        ELSE NULL
      END as distance_km
    FROM "Event" e
    WHERE 
      e.start_at >= ${where.startAt.gte || new Date()}
      ${filters?.categories && filters.categories.length > 0 ? prisma.$queryRaw`AND e.categories && ARRAY[${prisma.join(filters.categories)}]::text[]` : prisma.$queryRaw``}
      ${categories.length > 0 && (!filters?.categories || filters.categories.length === 0) ? prisma.$queryRaw`AND e.categories && ARRAY[${prisma.join(categories)}]::text[]` : prisma.$queryRaw``}
      ${filters?.free ? prisma.$queryRaw`AND e.price_free = true` : prisma.$queryRaw``}
      AND (
        to_tsvector('simple', e.search_text) @@ plainto_tsquery('simple', ${searchTerms})
        OR to_tsvector('simple', COALESCE(e.search_text_folded, '')) @@ plainto_tsquery('simple', ${searchTermsFolded})
      )
    ORDER BY 
      rank DESC,
      CASE WHEN distance_km IS NOT NULL THEN distance_km ELSE 999999 END ASC,
      e.start_at ASC
    LIMIT ${limit}
  `

  // Transform to SearchResult format
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
    snippet: event.description.slice(0, 200) + "...",
    distanceKm: event.distance_km ? Math.round(event.distance_km * 10) / 10 : undefined,
    categories: event.categories,
    priceFree: event.price_free,
    imageUrl: event.image_urls?.[0],
  }))
}
