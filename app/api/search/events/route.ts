import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"
import type { EventCategory } from "@prisma/client"
import { searchWeb } from "@/lib/search/web-search"

const EXTERNAL_STUB_EVENTS = [
  {
    id: "ext-1",
    title: "Summer Music Festival",
    description: "Annual outdoor music festival featuring local and international artists",
    startAt: new Date("2025-07-15T18:00:00Z"),
    endAt: new Date("2025-07-15T23:00:00Z"),
    location: {
      address: "Central Park",
      city: "New York",
      country: "USA",
    },
    imageUrl: "/vibrant-music-festival.png",
    externalUrl: "https://example.com/summer-fest",
    source: "web",
  },
  {
    id: "ext-2",
    title: "Tech Conference 2025",
    description: "Leading technology conference with workshops and networking",
    startAt: new Date("2025-08-20T09:00:00Z"),
    endAt: new Date("2025-08-22T17:00:00Z"),
    location: {
      address: "Convention Center",
      city: "San Francisco",
      country: "USA",
    },
    imageUrl: "/tech-conference.png",
    externalUrl: "https://example.com/tech-conf",
    source: "web",
  },
]

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("query") || url.searchParams.get("q") || "").trim()
  const take = Math.min(Number.parseInt(url.searchParams.get("take") || "20", 10) || 20, 50)
  const page = Math.max(Number.parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
  const skip = (page - 1) * take
  const city = url.searchParams.get("city")
  const country = url.searchParams.get("country")
  const category = url.searchParams.get("category")
  const dateFrom = url.searchParams.get("date_from")
  const dateTo = url.searchParams.get("date_to")

  console.log("[v0] Search params:", { q, city, category, dateFrom, dateTo })

  try {
    // If no query and no filters, return empty
    if (!q && !city && !category && !dateFrom && !dateTo) {
      return NextResponse.json({
        events: [],
        count: 0,
        page: 1,
        take,
        internal: [],
        external: [],
        total: 0,
      })
    }

    if (!q) {
      const where: any = {
        ...PUBLIC_EVENT_WHERE,
      }

      if (category && category !== "all") {
        const categoryEnum = category.toUpperCase() as EventCategory
        where.category = categoryEnum
      }

      if (dateFrom) {
        where.startAt = { ...where.startAt, gte: new Date(dateFrom) }
      }
      if (dateTo) {
        where.startAt = { ...where.startAt, lte: new Date(dateTo) }
      }

      if (city) {
        where.city = { contains: city, mode: "insensitive" }
      }
      if (country) {
        where.country = { contains: country, mode: "insensitive" }
      }

      let events, count
      try {
        [events, count] = await Promise.all([
          withLanguageColumnGuard(() => prisma.event.findMany({
            where,
            orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
            take,
            skip,
          })),
          prisma.event.count({ where }),
        ])
      } catch (error: any) {
        // If language column is missing, Prisma will fail
        // Return empty results rather than 500 error
        // The warning has already been logged by withLanguageColumnGuard
        console.error("[SEARCH FALLBACK] Query failed, returning empty results:", error?.message)
        return NextResponse.json({
          events: [],
          count: 0,
          page: 1,
          take,
          internal: [],
          external: [],
          total: 0,
        })
      }
      return NextResponse.json({
        events,
        count,
        page,
        take,
        internal: events,
        external: [],
        total: count,
      })
    }

    // Clean query: remove city if provided as separate filter, but keep category terms for better matching
    let cleanedQuery = q
    if (city) {
      // Remove city name from query (case-insensitive) to avoid double-matching
      const cityRegex = new RegExp(`\\b${city}\\b`, "gi")
      cleanedQuery = cleanedQuery.replace(cityRegex, "").trim()
    }
    // Don't remove category from query - it helps with text matching
    // The category filter will be applied separately as a filter
    
    // Clean up multiple spaces
    cleanedQuery = cleanedQuery.replace(/\s+/g, " ").trim()
    
    // If cleaned query is empty but we have filters, use empty string (will search by filters only)
    // If cleaned query is not empty, use it for text search

    console.log("[v0] Cleaned query:", cleanedQuery, "from original:", q, "city:", city, "category:", category)

    const where: any = {
      ...PUBLIC_EVENT_WHERE,
    }

    // Build OR clause for text search (only if we have a cleaned query)
    // If cleaned query is empty but we have filters, we'll search by filters only
    if (cleanedQuery) {
      where.OR = [
        { title: { contains: cleanedQuery, mode: "insensitive" } },
        { description: { contains: cleanedQuery, mode: "insensitive" } },
        { venueName: { contains: cleanedQuery, mode: "insensitive" } },
      ]
      // Only include city/country in OR if not filtering by them
      if (!city) {
        where.OR.push({ city: { contains: cleanedQuery, mode: "insensitive" } })
      }
      if (!country) {
        where.OR.push({ country: { contains: cleanedQuery, mode: "insensitive" } })
      }
    }
    // If cleaned query is empty but we have city/category filters, search by those filters only
    // (no OR clause needed - filters will be applied below)

    // Apply category filter
    if (category && category !== "all") {
      // Map category string to EventCategory enum
      const categoryMap: Record<string, EventCategory> = {
        food: "FOOD_DRINK",
        music: "MUSIC_NIGHTLIFE",
        arts: "ARTS_CULTURE",
        sports: "SPORTS_OUTdoors",
        family: "FAMILY_KIDS",
        community: "COMMUNITY_CAUSES",
        learning: "LEARNING_TALKS",
        markets: "MARKETS_FAIRS",
        online: "ONLINE_VIRTUAL",
      }
      const normalizedCategory = category.toLowerCase()
      const categoryEnum = categoryMap[normalizedCategory] || (category.toUpperCase() as EventCategory)
      
      // Check both the category field and the categories array
      const categoryConditions: any[] = [
        { category: categoryEnum },
        { categories: { hasSome: [category, normalizedCategory, categoryEnum] } },
      ]
      
      // If we have an OR clause for text search, combine with AND
      if (where.OR && where.OR.length > 0) {
        // We have both text search and category filter - combine with AND
        const textSearchOR = where.OR
        delete where.OR
        where.AND = [
          { OR: textSearchOR },
          { OR: categoryConditions },
        ]
      } else {
        // No text search, just filter by category
        where.OR = categoryConditions
      }
    }

    if (dateFrom) {
      where.startAt = { ...where.startAt, gte: new Date(dateFrom) }
    }
    if (dateTo) {
      where.startAt = { ...where.startAt, lte: new Date(dateTo) }
    }

    // City filter: must match exactly (case-insensitive)
    // If we have an AND array, add city to it; otherwise add as top-level property
    if (city) {
      const cityFilter = { city: { contains: city, mode: "insensitive" } }
      if (where.AND && Array.isArray(where.AND)) {
        where.AND.push(cityFilter)
      } else {
        where.city = cityFilter.city
      }
    }
    if (country) {
      const countryFilter = { country: { contains: country, mode: "insensitive" } }
      if (where.AND && Array.isArray(where.AND)) {
        where.AND.push(countryFilter)
      } else {
        where.country = countryFilter.country
      }
    }

    console.log("[v0] Final where clause:", JSON.stringify(where, null, 2))

    let events, count
    try {
      [events, count] = await Promise.all([
        withLanguageColumnGuard(() => prisma.event.findMany({
          where,
          orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
          take,
          skip,
        })),
        prisma.event.count({ where }),
      ])
    } catch (error: any) {
      // If language column is missing, Prisma will fail
      // Return empty results rather than 500 error
      // The warning has already been logged by withLanguageColumnGuard
      console.error("[SEARCH FALLBACK] Query failed, returning empty results:", error?.message)
      return NextResponse.json({
        events: [],
        count: 0,
        page,
        take,
        internal: [],
        external: [],
        total: 0,
      })
    }

    console.log("[v0] Search query:", q, "filters:", { city, category, dateFrom, dateTo }, "found:", count, "events")

    // Always search web if we have a query (not just when results are low)
    let webResults: any[] = []
    const shouldSearchWeb = q.trim().length > 0
    
    if (shouldSearchWeb) {
      const hasGoogleConfig = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_PSE_ID)
      console.log("[v0] Searching web...", { 
        hasGoogleConfig, 
        hasApiKey: !!process.env.GOOGLE_API_KEY, 
        hasPseId: !!process.env.GOOGLE_PSE_ID 
      })
      
      try {
        // Build web search query from original query, city, and category
        let webQuery = q
        if (city && !webQuery.toLowerCase().includes(city.toLowerCase())) {
          webQuery = `${webQuery} ${city}`
        }
        if (category && category !== "all" && !webQuery.toLowerCase().includes(category.toLowerCase())) {
          webQuery = `${webQuery} ${category}`
        }
        // Add "events" to improve search results
        if (!webQuery.toLowerCase().includes("event")) {
          webQuery = `${webQuery} events`
        }
        
        console.log("[v0] Web search query:", webQuery.trim())
        
        const webSearchResults = await searchWeb({
          query: webQuery.trim(),
          limit: 10,
        })
        
        // Transform web results to match expected format (both internal and external formats)
        webResults = webSearchResults.map((result, index) => {
          // Try to extract city from snippet if not provided
          let extractedCity = city || ""
          if (!extractedCity && result.snippet) {
            // Simple extraction: look for common city patterns in snippet
            const cityMatch = result.snippet.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/)
            if (cityMatch) {
              extractedCity = cityMatch[1]
            }
          }
          
          return {
            id: `web-${Date.now()}-${index}`,
            title: result.title,
            description: result.snippet || "",
            startAt: result.startAt,
            endAt: result.startAt, // Use same as start if no end date
            city: extractedCity,
            country: "",
            address: "",
            venueName: "",
            categories: category && category !== "all" ? [category] : [],
            priceFree: false,
            imageUrls: result.imageUrl ? [result.imageUrl] : [],
            status: "PUBLISHED" as const,
            aiStatus: "SAFE" as const,
            source: "web" as const,
            externalUrl: result.url,
            imageUrl: result.imageUrl || undefined, // Preserve imageUrl from web search
            // Also include location object for compatibility with external format
            location: {
              city: extractedCity,
              country: "",
              address: "",
            },
          }
        })
        
        console.log("[v0] Web search found:", webResults.length, "events")
      } catch (error: any) {
        console.error("[v0] Web search error:", error?.message || error)
        console.error("[v0] Web search error details:", {
          hasApiKey: !!process.env.GOOGLE_API_KEY,
          hasPseId: !!process.env.GOOGLE_PSE_ID,
          error: error?.message || String(error),
        })
        // Continue without web results
      }
    } else if (!q.trim()) {
      console.log("[v0] Skipping web search - no query provided")
    }

    // Legacy stub events (can be removed if web search is working)
    const externalEvents = EXTERNAL_STUB_EVENTS.filter((event) => {
      const matchesQuery =
        event.title.toLowerCase().includes(q.toLowerCase()) ||
        event.description.toLowerCase().includes(q.toLowerCase()) ||
        event.location.city.toLowerCase().includes(q.toLowerCase())

      const matchesCity = !city || event.location.city.toLowerCase().includes(city.toLowerCase())
      const matchesCountry = !country || event.location.country.toLowerCase().includes(country.toLowerCase())

      return matchesQuery && matchesCity && matchesCountry
    })

    // Filter web results by city if city filter is specified
    let filteredWebResults = webResults
    if (city) {
      const cityLower = city.toLowerCase()
      filteredWebResults = webResults.filter((result) => {
        const resultCity = (result.city || result.location?.city || "").toLowerCase()
        return resultCity.includes(cityLower) || cityLower.includes(resultCity)
      })
      console.log(`[v0] Filtered web results by city "${city}": ${webResults.length} → ${filteredWebResults.length}`)
    }

    // Combine internal and web results
    const allEvents = [...events, ...filteredWebResults]
    
    // Sort results: prioritize city matches, then by date
    if (city) {
      const cityLower = city.toLowerCase()
      allEvents.sort((a, b) => {
        const aCity = (a.city || "").toLowerCase()
        const bCity = (b.city || "").toLowerCase()
        const aMatchesCity = aCity.includes(cityLower) || cityLower.includes(aCity)
        const bMatchesCity = bCity.includes(cityLower) || cityLower.includes(bCity)
        
        // First sort: city match (matching city first)
        if (aMatchesCity && !bMatchesCity) return -1
        if (!aMatchesCity && bMatchesCity) return 1
        
        // Second sort: date (earlier dates first)
        const aDate = new Date(a.startAt).getTime()
        const bDate = new Date(b.startAt).getTime()
        return aDate - bDate
      })
    } else {
      // No city filter: just sort by date
      allEvents.sort((a, b) => {
        const aDate = new Date(a.startAt).getTime()
        const bDate = new Date(b.startAt).getTime()
        return aDate - bDate
      })
    }
    
    const allExternal = [...filteredWebResults, ...externalEvents]

    return NextResponse.json({
      events: allEvents,
      count: allEvents.length,
      page,
      take,
      query: q,
      internal: events,
      external: allExternal,
      total: allEvents.length,
    })
  } catch (e: any) {
    console.error("[v0] search/events error:", e)
    return NextResponse.json(
      {
        events: [],
        count: 0,
        internal: [],
        external: [],
        total: 0,
        error: String(e?.message || e),
      },
      { status: 500 },
    )
  }
}
