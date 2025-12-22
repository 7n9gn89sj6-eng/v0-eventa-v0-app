import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"
import type { EventCategory } from "@prisma/client"
import { searchWeb } from "@/lib/search/web-search"
import { withLanguageColumnGuard, getEventSelectWithoutLanguage, isLanguageFilteringAvailable } from "@/lib/db-runtime-guard"

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

  // Define 'now' once at the top level for reuse throughout the function
  const now = new Date()

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
      // BUILD WHERE CLAUSE IN PRIORITY ORDER:
      // 1. Location (city/country) - FIRST PRIORITY
      // 2. Date (always forward of today) - SECOND PRIORITY
      // 3. Category - LOWER PRIORITY

      const where: any = {
        ...PUBLIC_EVENT_WHERE,
      }

      // PRIORITY 1: LOCATION FILTERS (city/country) - applied first
      if (city) {
        where.city = { contains: city, mode: "insensitive" }
      }
      if (country) {
        where.country = { contains: country, mode: "insensitive" }
      }

      // PRIORITY 2: DATE FILTER - always forward of today (default: future events only)
      where.startAt = {
        gte: now, // Default: only show future events
      }

      // Apply date filters if provided, but ensure they're forward of today
      if (dateFrom) {
        const dateFromDate = new Date(dateFrom)
        // If dateFrom is in the past, use "now" instead to avoid showing past events
        where.startAt.gte = dateFromDate > now ? dateFromDate : now
      }
      if (dateTo) {
        where.startAt.lte = new Date(dateTo)
      }

      // PRIORITY 3: CATEGORY - applied after location and date
      if (category && category !== "all") {
        const categoryEnum = category.toUpperCase() as EventCategory
        where.category = categoryEnum
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
        // If language column is missing, retry with explicit select excluding language
        if (!isLanguageFilteringAvailable()) {
          try {
            [events, count] = await Promise.all([
              prisma.event.findMany({
                where,
                select: getEventSelectWithoutLanguage(),
          orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
          take,
          skip,
        }),
        prisma.event.count({ where }),
      ])
          } catch (retryError: any) {
            console.error("[SEARCH FALLBACK] Retry query also failed:", retryError?.message)
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
        } else {
          // Some other error - rethrow
          throw error
        }
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

    // BUILD WHERE CLAUSE IN PRIORITY ORDER:
    // 1. Location (city/country) - FIRST PRIORITY
    // 2. Date (always forward of today) - SECOND PRIORITY
    // 3. Text search, category, etc. - LOWER PRIORITY

    const where: any = {
      ...PUBLIC_EVENT_WHERE,
    }

    // PRIORITY 1: LOCATION FILTERS (city/country) - applied first
    if (city) {
      where.city = { contains: city, mode: "insensitive" }
    }
    if (country) {
      where.country = { contains: country, mode: "insensitive" }
    }

    // PRIORITY 2: DATE FILTER - always forward of today (default: future events only)
    where.startAt = {
      gte: now, // Default: only show future events
    }

    // Apply date filters if provided, but ensure they're forward of today
    if (dateFrom) {
      const dateFromDate = new Date(dateFrom)
      // If dateFrom is in the past, use "now" instead to avoid showing past events
      where.startAt.gte = dateFromDate > now ? dateFromDate : now
    }
    if (dateTo) {
      where.startAt.lte = new Date(dateTo)
    }

    // PRIORITY 3: TEXT SEARCH AND CATEGORY - applied after location and date
    // Build OR clause for text search (only if we have a cleaned query)
    if (cleanedQuery) {
      where.OR = [
        { title: { contains: cleanedQuery, mode: "insensitive" } },
        { description: { contains: cleanedQuery, mode: "insensitive" } },
        { venueName: { contains: cleanedQuery, mode: "insensitive" } },
      ]
      // Only include city/country in OR if not already filtering by them
      if (!city) {
        where.OR.push({ city: { contains: cleanedQuery, mode: "insensitive" } })
      }
      if (!country) {
        where.OR.push({ country: { contains: cleanedQuery, mode: "insensitive" } })
      }
    }

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
      // If language column is missing, retry with explicit select excluding language
      if (!isLanguageFilteringAvailable()) {
        try {
          [events, count] = await Promise.all([
            prisma.event.findMany({
              where,
              select: getEventSelectWithoutLanguage(),
        orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
      prisma.event.count({ where }),
    ])
        } catch (retryError: any) {
          console.error("[SEARCH FALLBACK] Retry query also failed:", retryError?.message)
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
      } else {
        // Some other error - rethrow
        throw error
      }
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
        // For ambiguous cities, add country to improve disambiguation
        let webQuery = q
        if (city) {
          const cityLower = city.toLowerCase().trim()
          const ambiguousCities: Record<string, string> = {
            "melbourne": "Australia",
            "ithaca": country || "",
            "ithaki": "Greece",
            "cambridge": country || "",
            "naples": country || "Italy",
            "berlin": country || "Germany",
            "paris": country || "France",
            "london": country || "UK",
            "rome": country || "Italy",
            "athens": country || "Greece",
            "milan": country || "Italy",
            "vienna": country || "Austria",
            "madrid": country || "Spain",
          }
          
          if (!webQuery.toLowerCase().includes(cityLower)) {
          webQuery = `${webQuery} ${city}`
            
            // Add country for ambiguous cities to improve Google search accuracy
            if (ambiguousCities[cityLower] && !country) {
              webQuery = `${webQuery} ${ambiguousCities[cityLower]}`
            } else if (country && !webQuery.toLowerCase().includes(country.toLowerCase())) {
              webQuery = `${webQuery} ${country}`
            }
          }
        } else if (country && !webQuery.toLowerCase().includes(country.toLowerCase())) {
          webQuery = `${webQuery} ${country}`
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
        let transformedWebResults = webSearchResults.map((result, index) => {
          // Try to extract city from snippet if not provided
          let extractedCity = city || ""
          let extractedCountry = country || ""
          
          if (!extractedCity && result.snippet) {
            // Simple extraction: look for common city patterns in snippet
            const cityMatch = result.snippet.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/)
            if (cityMatch) {
              extractedCity = cityMatch[1]
            }
          }
          
          // Try to extract country from snippet/URL
          if (!extractedCountry && result.snippet) {
            const countryMatch = result.snippet.match(/\b(Australia|USA|United States|UK|United Kingdom|Greece|Italy|Spain|France|Germany)\b/i)
            if (countryMatch) {
              extractedCountry = countryMatch[1]
            }
          }
          
          return {
            id: `web-${Date.now()}-${index}`,
            title: result.title,
            description: result.snippet || "",
            startAt: result.startAt,
            endAt: result.startAt, // Use same as start if no end date
            city: extractedCity,
            country: extractedCountry,
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
              country: extractedCountry,
              address: "",
            },
          }
        })
        
        // Filter web results by city if specified
        if (city) {
          const cityLower = city.toLowerCase().trim()
          const beforeCityFilter = transformedWebResults.length
          
          // Known ambiguous cities that need country disambiguation
          const ambiguousCities: Record<string, string[]> = {
            "melbourne": ["australia", "florida", "usa"],
            "ithaca": ["greece", "new york", "usa"],
            "ithaki": ["greece"],
            "cambridge": ["united kingdom", "uk", "massachusetts", "usa"],
            "naples": ["italy", "florida", "usa"],
            "berlin": ["germany", "maryland", "usa"],
            "paris": ["france", "texas", "usa"],
            "london": ["united kingdom", "uk", "ontario", "canada"],
            "rome": ["italy", "georgia", "usa"],
            "athens": ["greece", "georgia", "usa"],
            "milan": ["italy", "tennessee", "usa"],
            "vienna": ["austria", "virginia", "usa"],
            "madrid": ["spain", "new mexico", "usa"],
          }
          
          const isAmbiguous = ambiguousCities[cityLower] !== undefined
          const expectedCountries = isAmbiguous ? ambiguousCities[cityLower] : []
          const countryLower = country ? country.toLowerCase().trim() : null
          
          transformedWebResults = transformedWebResults.filter((result) => {
            const resultText = `${result.title} ${result.description} ${result.city} ${result.country} ${result.location?.city || ""} ${result.location?.country || ""}`.toLowerCase()
            const cityRegex = new RegExp(`\\b${cityLower}\\b`, "i")
            const matchesCity = cityRegex.test(resultText)
            
            if (!matchesCity) {
              return false
            }
            
            // Apply disambiguation for ambiguous cities
            if (isAmbiguous) {
              if (countryLower) {
                // Country specified - check if result matches expected country
                const countryMatches = expectedCountries.some((expectedCountry) => {
                  const expectedLower = expectedCountry.toLowerCase()
                  return resultText.includes(expectedLower) || 
                         (expectedLower.includes("usa") && /\b(usa|united states|us|america)\b/i.test(resultText)) ||
                         (expectedLower.includes("uk") && /\b(uk|united kingdom|britain|british)\b/i.test(resultText))
                })
                
                if (countryLower) {
                  const specifiedMatchesExpected = expectedCountries.some((expectedCountry) => {
                    const expectedLower = expectedCountry.toLowerCase()
                    return countryLower.includes(expectedLower) || expectedLower.includes(countryLower)
                  })
                  
                  if (specifiedMatchesExpected && !countryMatches) {
                    return false // Exclude if country was specified but doesn't match
                  }
                }
              } else {
                // No country specified - exclude US state matches for major international cities
                const hasUSState = /\b(maryland|md|california|ca|texas|tx|new york|ny|florida|fl|georgia|ga|tennessee|tn|virginia|va|new mexico|nm|massachusetts|ma|ontario)\b/i.test(resultText)
                const hasUSCountry = /\b(usa|united states|us|america)\b/i.test(resultText)
                const hasAustralia = /\b(australia|australian)\b/i.test(resultText)
                
                // For Melbourne, prefer Australia over US
                if (cityLower === "melbourne") {
                  if (hasUSState && !hasAustralia) {
                    return false // Exclude US Melbourne if no Australia mention
                  }
                } else if (hasUSState && !hasUSCountry) {
                  // For other ambiguous cities, exclude US state matches unless US is mentioned
                  return false
                }
              }
            }
            
            return true
          })
          
          if (beforeCityFilter !== transformedWebResults.length) {
            console.log(`[v0] Filtered web results by city "${city}": ${beforeCityFilter} -> ${transformedWebResults.length}`)
          }
        }

        webResults = transformedWebResults
        
        console.log("[v0] Web search found:", webResults.length, "events after filtering")
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
    const stubExternalEvents = EXTERNAL_STUB_EVENTS.filter((event) => {
      const matchesQuery =
        event.title.toLowerCase().includes(q.toLowerCase()) ||
        event.description.toLowerCase().includes(q.toLowerCase()) ||
        event.location.city.toLowerCase().includes(q.toLowerCase())

      const matchesCity = !city || event.location.city.toLowerCase().includes(city.toLowerCase())
      const matchesCountry = !country || event.location.country.toLowerCase().includes(country.toLowerCase())

      return matchesQuery && matchesCity && matchesCountry
    })

    // Filter web results: exclude past events and apply city filter if specified
    let filteredWebResults = webResults.filter((result) => {
      // Exclude past events - only show future events
      if (result.startAt) {
        try {
          const eventDate = new Date(result.startAt)
          if (eventDate < now) {
            return false // Exclude past events
          }
        } catch {
          // Invalid date, keep it but it will be labeled as informational
        }
      }
      return true
    })
    
    // Apply city filter if specified
    if (city) {
      const cityLower = city.toLowerCase()
      const beforeCityFilter = filteredWebResults.length
      filteredWebResults = filteredWebResults.filter((result) => {
        const resultCity = (result.city || result.location?.city || "").toLowerCase()
        return resultCity.includes(cityLower) || cityLower.includes(resultCity)
      })
      console.log(`[v0] Filtered web results by city "${city}": ${beforeCityFilter} → ${filteredWebResults.length}`)
    }
    
    console.log(`[v0] Filtered web results (past events excluded): ${webResults.length} → ${filteredWebResults.length}`)

    // PRIORITY: Internal events (user-created, curated) ALWAYS come FIRST
    // External web results come AFTER, regardless of date or city match
    // This ensures user satisfaction with accurate, curated events
    
    // Mark internal events with source
    const internalEvents = events.map((e: any) => ({
      ...e,
      source: "internal" as const,
      isEventaEvent: true,
    }))
    
    // Mark external events with source
    const externalEvents = filteredWebResults.map((e: any) => ({
      ...e,
      source: "web" as const,
      isWebResult: true,
    }))
    
    // Sort internal events: prioritize city matches, then by date
    if (city) {
      const cityLower = city.toLowerCase()
      internalEvents.sort((a, b) => {
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
      internalEvents.sort((a, b) => {
        const aDate = new Date(a.startAt).getTime()
        const bDate = new Date(b.startAt).getTime()
        return aDate - bDate
      })
    }
    
    // Sort external events similarly (but they'll appear after internal)
    if (city) {
      const cityLower = city.toLowerCase()
      externalEvents.sort((a, b) => {
        const aCity = (a.city || "").toLowerCase()
        const bCity = (b.city || "").toLowerCase()
        const aMatchesCity = aCity.includes(cityLower) || cityLower.includes(aCity)
        const bMatchesCity = bCity.includes(cityLower) || cityLower.includes(bCity)
        
        if (aMatchesCity && !bMatchesCity) return -1
        if (!aMatchesCity && bMatchesCity) return 1
        
        const aDate = new Date(a.startAt).getTime()
        const bDate = new Date(b.startAt).getTime()
        return aDate - bDate
      })
    } else {
      externalEvents.sort((a, b) => {
        const aDate = new Date(a.startAt).getTime()
        const bDate = new Date(b.startAt).getTime()
        return aDate - bDate
      })
    }
    
    // Combine: Internal events FIRST, then external events
    const allEvents = [...internalEvents, ...externalEvents]
    
    const allExternal = [...externalEvents, ...stubExternalEvents]

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
