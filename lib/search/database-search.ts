import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import type { SearchResult, SearchFilters } from "@/lib/types"
import { DateTime } from "luxon"
import { foldAccents } from "@/lib/search/accent-fold"
import { logger } from "@/lib/logger"

// Type for raw database query result
interface DatabaseEventRow {
  id: string
  title: string
  description: string | null
  startAt: Date | string
  endAt: Date | string
  city: string
  country: string
  venueName: string | null
  address: string | null
  lat: number | null
  lng: number | null
  categories: string[]
  priceFree: boolean
  imageUrls: string[]
  rank: number
  distance_km: number | null
}

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
  try {
    const { query, synonyms, categories, filters, userLat, userLng, limit = 20 } = options

    // Build search terms - join with OR operator for PostgreSQL full-text search
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

  // Public event filter - only show PUBLISHED events with APPROVED moderation status
  // Note: Prisma uses camelCase column names
  const publicEventFilter = Prisma.sql`AND e.status = 'PUBLISHED' AND e."moderationStatus" = 'APPROVED'`

  // Execute search query
  // Note: Prisma uses camelCase for column names, so we need to quote them
  // Escape search terms for SQL injection safety - replace single quotes with double single quotes
  const escapedSearchTerms = searchTerms.replace(/'/g, "''")
  const escapedSearchTermsFolded = searchTermsFolded.replace(/'/g, "''")
  
  // Use Prisma.raw() to safely inject escaped strings into SQL
  const searchTermsSQL = Prisma.raw(`'${escapedSearchTerms}'`)
  const searchTermsFoldedSQL = Prisma.raw(`'${escapedSearchTermsFolded}'`)
  
  const events = await db.$queryRaw<DatabaseEventRow[]>(Prisma.sql`
    SELECT 
      e.id, e.title, e.description, e."startAt", e."endAt", e.city, e.country,
      e."venueName", e.address, e.lat, e.lng, e.categories, e."priceFree", e."imageUrls",
      GREATEST(
        ts_rank(to_tsvector('simple', e."searchText"), plainto_tsquery('simple', ${searchTermsSQL}::text)),
        ts_rank(to_tsvector('simple', COALESCE(e."searchTextFolded", '')), plainto_tsquery('simple', ${searchTermsFoldedSQL}::text))
      ) AS rank,
      CASE 
        WHEN ${userLat ?? null}::float IS NOT NULL 
         AND ${userLng ?? null}::float IS NOT NULL 
         AND e.lat IS NOT NULL 
         AND e.lng IS NOT NULL
        THEN (
          6371 * acos(
            cos(radians(${userLat ?? null}::float)) * cos(radians(e.lat)) *
            cos(radians(e.lng) - radians(${userLng ?? null}::float)) +
            sin(radians(${userLat ?? null}::float)) * sin(radians(e.lat))
          )
        )
        ELSE NULL
      END AS distance_km
    FROM "Event" e
    WHERE 
      e."startAt" >= ${where.startAt.gte || new Date()}
      ${publicEventFilter}
      ${categorySQL}
      ${requiresFree}
      AND (
        to_tsvector('simple', e."searchText") @@ plainto_tsquery('simple', ${searchTermsSQL}::text)
        OR to_tsvector('simple', COALESCE(e."searchTextFolded", '')) @@ plainto_tsquery('simple', ${searchTermsFoldedSQL}::text)
      )
    ORDER BY 
      rank DESC,
      CASE WHEN distance_km IS NOT NULL THEN distance_km ELSE 999999 END ASC,
      e."startAt" ASC
    LIMIT ${limit}
  `)

  // Convert rows to SearchResult
  // Note: Prisma returns camelCase field names from raw queries
  return events.map((event) => {
    const startAt = event.startAt instanceof Date ? event.startAt : new Date(event.startAt);
    const endAt = event.endAt instanceof Date ? event.endAt : new Date(event.endAt);
    
    return {
      source: "eventa" as const,
      id: event.id,
      title: event.title,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      venue: event.venueName || null,
      address: event.address || null,
      lat: event.lat ?? null,
      lng: event.lng ?? null,
      url: `/events/${event.id}`,
      snippet: (event.description || "").slice(0, 200) + (event.description && event.description.length > 200 ? "..." : ""),
      distanceKm: event.distance_km ? Math.round(event.distance_km * 10) / 10 : undefined,
      categories: event.categories || [],
      priceFree: event.priceFree ?? false,
      imageUrl: event.imageUrls?.[0] || null,
    };
  })
  } catch (error) {
    logger.error("[searchDatabase] Database search failed", error, {
      query: options.query,
      synonyms: options.synonyms,
      categories: options.categories,
      filters: options.filters,
    });
    throw error;
  }
}
