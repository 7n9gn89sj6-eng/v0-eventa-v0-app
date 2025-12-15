import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
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

  // Build where-clause
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
  const categoryArray =
    filters?.categories?.length ? filters.categories : categories.length ? categories : []

  // Price filter
  const requiresFree = filters?.free ? Prisma.sql`AND e.price_free = true` : Prisma.empty

  // Category SQL
  const categorySQL =
    categoryArray.length > 0
      ? Prisma.sql`AND e.categories && ARRAY[${Prisma.join(categoryArray)}]::text[]`
      : Prisma.empty

  // Public event filter - only show PUBLISHED events with SAFE AI status
  const publicEventFilter = Prisma.sql`AND e.status = 'PUBLISHED' AND e.moderation_status = 'APPROVED'`

  // Execute search query
  const events = await db.$queryRaw<any[]>(Prisma.sql`
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
      e.start_at >= ${where.startAt.gte || new Date()}
      ${publicEventFilter}
      ${categorySQL}
      ${requiresFree}
      AND (
        to_tsvector('simple', e.search_text) @@ plainto_tsquery('simple', ${searchTerms})
        OR to_tsvector('simple', COALESCE(e.search_text_folded, '')) @@ plainto_tsquery('simple', ${searchTermsFolded})
      )
    ORDER BY 
      rank DESC,
      CASE WHEN distance_km IS NOT NULL THEN distance_km ELSE 999999 END ASC,
      e.start_at ASC
    LIMIT ${limit}
  `)

  // Convert rows to SearchResult
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
    snippet: (event.description || "").slice(0, 200) + "...",
    distanceKm: event.distance_km ? Math.round(event.distance_km * 10) / 10 : undefined,
    categories: event.categories,
    priceFree: event.price_free,
    imageUrl: event.image_urls?.[0],
  }))
}
