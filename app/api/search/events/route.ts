import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"
import type { EventCategory } from "@prisma/client"
import { searchWeb } from "@/lib/search/web-search"
import { withLanguageColumnGuard, getEventSelectWithoutLanguage, isLanguageFilteringAvailable } from "@/lib/db-runtime-guard"
import { buildDateOverlapWhere, buildDateRangeOverlapWhere } from "@/lib/search/date-overlap"
import { rankEventResults, isEventIntentQuery } from "@/lib/search/event-ranking"

/**
 * Helper function to check if text contains Australian location indicators
 * @param text - Text to check
 * @returns true if text contains Australian indicators
 */
function hasAustraliaIndicators(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return /\b(australia|australian|au|melbourne|sydney|brisbane|perth|adelaide|canberra|darwin|vic|victoria|naarm|tasmania|queensland|nsw|new south wales|western australia|wa|south australia|sa|northern territory|nt|australian capital territory|act)\b/i.test(lower)
}

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
  let city = url.searchParams.get("city")
  let country = url.searchParams.get("country")
  const category = url.searchParams.get("category")
  const dateFrom = url.searchParams.get("date_from")
  const dateTo = url.searchParams.get("date_to")
  const debug = url.searchParams.get("debug") === "1"

  // Define 'now' once at the top level for reuse throughout the function
  const now = new Date()

  // Detect if this is an event-intent query
  const isEventQuery = isEventIntentQuery(q)

  // NOTE: Location should come from URL params (city/country) set by UI location picker
  // Only extract from query as fallback if location params are not provided
  // This ensures web search uses the UI location control, not query extraction
  if (q && isEventQuery && !city && !country) {
    try {
      const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/search/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (intentResponse.ok) {
        const intentData = await intentResponse.json()
        const extracted = intentData.extracted || {}
        if (extracted.city && !city) {
          city = extracted.city.trim()
          console.log(`[v0] 🔍 Extracted city from query (fallback): "${city}"`)
        }
        if (extracted.country && !country) {
          country = extracted.country.trim()
          console.log(`[v0] 🔍 Extracted country from query (fallback): "${country}"`)
        }
      }
    } catch (error) {
      console.warn(`[v0] Failed to extract entities from query:`, error)
      // Continue without extraction - not critical
    }
  }

  console.log("[v0] Search params:", { q, city, country, category, dateFrom, dateTo, isEventQuery })
  if (city) {
    console.log(`[v0] ⚠️ FILTERING BY CITY: "${city}"${country ? `, COUNTRY: "${country}"` : ""}`)
  } else {
    console.log(`[v0] ⚠️ NO CITY FILTER - search will be broad`)
  }

  if (isEventQuery) {
    console.log(`[v0] 🎯 Event-intent query detected: "${q}" - will apply strict location filtering and automatic web fallback if no internal events`)
  }

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
        emptyState: false,
        includesWeb: false,
        isEventIntent: false,
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

      // PRIORITY 2: DATE FILTER - use overlap logic for multi-day events
      // Overlap rule: event.startAt <= searchEnd AND event.endAt >= searchStart
      if (dateFrom && dateTo) {
        const dateFromDate = new Date(dateFrom)
        const dateToDate = new Date(dateTo)
        const searchStart = dateFromDate > now ? dateFromDate : now
        const dateOverlap = buildDateRangeOverlapWhere(searchStart, dateToDate)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (range overlap): searchStart=${searchStart.toISOString()}, searchEnd=${dateToDate.toISOString()}`)
      } else if (dateFrom) {
        const dateFromDate = new Date(dateFrom)
        const searchStart = dateFromDate > now ? dateFromDate : now
        const dateOverlap = buildDateOverlapWhere(searchStart, null)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (start overlap): searchStart=${searchStart.toISOString()}`)
      } else if (dateTo) {
        const dateToDate = new Date(dateTo)
        const dateOverlap = buildDateOverlapWhere(now, dateToDate)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (end overlap): searchEnd=${dateToDate.toISOString()}`)
      } else {
        // Default: events must end after now (ongoing or future events)
        const dateOverlap = buildDateOverlapWhere(now, null)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (default overlap): events ending after ${now.toISOString()}`)
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
        emptyState: false,
        includesWeb: false,
        isEventIntent: false,
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
    // Handle city name variations (e.g., Brussels/Bruxelles, Athens/Αθήνα)
    if (city) {
      const cityLower = city.toLowerCase().trim()
      
      // City name variations map (English -> other language variants)
      const cityVariations: Record<string, string[]> = {
        "brussels": ["bruxelles", "brussel", "bruselas"],
        "athens": ["αθήνα", "athina", "athen"],
        "rome": ["roma", "rom"],
        "paris": ["paris"],
        "milan": ["milano"],
        "florence": ["firenze"],
        "naples": ["napoli"],
        "venice": ["venezia"],
        "vienna": ["wien"],
        "copenhagen": ["københavn", "kobenhavn"],
        "prague": ["praha"],
        "warsaw": ["warszawa"],
        "budapest": ["budapest"],
        "bucharest": ["bucurești", "bucuresti"],
      }
      
      // Check if we have variations for this city
      const variations = cityVariations[cityLower] || []
      const allCityNames = [cityLower, ...variations]
      
      // Build OR conditions for city matching (any variation OR city in title/description)
      const cityConditions: any[] = [
        // Match city field with any variation
        ...allCityNames.map(cityName => ({
          city: { contains: cityName, mode: "insensitive" },
        })),
        // Also match if city appears in title or description
        { title: { contains: cityLower, mode: "insensitive" } },
        { description: { contains: cityLower, mode: "insensitive" } },
      ]
      
      // Add city conditions to AND (we'll combine with other filters)
      where.AND = where.AND || []
      where.AND.push({ OR: cityConditions })
      
      console.log(`[v0] City filter with variations: ${city} → [${allCityNames.join(", ")}]`)
    }
    
    if (country) {
      where.country = { contains: country, mode: "insensitive" }
    }

    // PRIORITY 2: DATE FILTER - use overlap logic for multi-day events
    // Overlap rule: event.startAt <= searchEnd AND event.endAt >= searchStart
    // This ensures:
    // - Ongoing events (started in past, still running) are included
    // - Finished events (ended before search window) are excluded
    // - Future events are included if they overlap the search window
    if (dateFrom && dateTo) {
      // Specific date range: use overlap logic for the range
      const dateFromDate = new Date(dateFrom)
      const dateToDate = new Date(dateTo)
      const searchStart = dateFromDate > now ? dateFromDate : now
      const dateOverlap = buildDateRangeOverlapWhere(searchStart, dateToDate)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (range overlap): searchStart=${searchStart.toISOString()}, searchEnd=${dateToDate.toISOString()}`)
    } else if (dateFrom) {
      // Start date only: events must end after search start
      const dateFromDate = new Date(dateFrom)
      const searchStart = dateFromDate > now ? dateFromDate : now
      const dateOverlap = buildDateOverlapWhere(searchStart, null)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (start overlap): searchStart=${searchStart.toISOString()}`)
    } else if (dateTo) {
      // End date only: events must start before search end and end after now
      const dateToDate = new Date(dateTo)
      const dateOverlap = buildDateOverlapWhere(now, dateToDate)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (end overlap): searchEnd=${dateToDate.toISOString()}`)
    } else {
      // Default: events must end after now (ongoing or future events)
      const dateOverlap = buildDateOverlapWhere(now, null)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (default overlap): events ending after ${now.toISOString()}`)
    }

    // PRIORITY 3: TEXT SEARCH AND CATEGORY - applied after location and date
    // Build OR clause for text search (only if we have a cleaned query)
    if (cleanedQuery) {
      // Split query into individual words for more flexible matching
      // This allows matching "Xmas market" even if the event has "Christmas Market"
      const queryWords = cleanedQuery
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.toLowerCase().trim())
      
      // Build text search conditions - match if ANY word from the query appears
      // This is more flexible than requiring the entire phrase
      const textSearchConditions: any[] = []
      
      if (queryWords.length > 0) {
        // Synonym mapping for common terms
        const synonymMap: Record<string, string[]> = {
          "xmas": ["christmas", "x-mas", "noel", "navidad", "natal"],
          "christmas": ["xmas", "x-mas", "noel", "navidad", "natal"],
          "market": ["markets", "flea market", "bazaar", "fair", "fiesta"],
          "markets": ["market", "flea market", "bazaar", "fair", "fiesta"],
        }
        
        // For each word, check if it appears in title, description, or venueName
        // Include synonyms for better matching (e.g., "Xmas" matches "Christmas")
        queryWords.forEach(word => {
          const wordLower = word.toLowerCase()
          const synonyms = synonymMap[wordLower] || []
          const allTerms = [wordLower, ...synonyms]
          
          // Build OR conditions for this word and its synonyms
          const wordConditions: any[] = []
          allTerms.forEach(term => {
            wordConditions.push(
              { title: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
              { venueName: { contains: term, mode: "insensitive" } },
            )
          })
          
          // Each word must match somewhere (AND across words, OR within each word+synonyms)
          textSearchConditions.push({
            OR: wordConditions,
          })
        })
      }
      
      // If we have conditions, use AND to require all words match
      if (textSearchConditions.length > 0) {
        where.AND = where.AND || []
        where.AND.push(...textSearchConditions)
      } else {
        // Fallback: if no words extracted, use original full phrase search
        // Use AND structure to be compatible with city filter
        const fallbackConditions: any[] = [
          { title: { contains: cleanedQuery, mode: "insensitive" } },
          { description: { contains: cleanedQuery, mode: "insensitive" } },
          { venueName: { contains: cleanedQuery, mode: "insensitive" } },
        ]
        // Only include city/country in OR if not already filtering by them
        if (!city) {
          fallbackConditions.push({ city: { contains: cleanedQuery, mode: "insensitive" } })
        }
        if (!country) {
          fallbackConditions.push({ country: { contains: cleanedQuery, mode: "insensitive" } })
        }
        
        // Add as OR condition inside AND structure
        where.AND = where.AND || []
        where.AND.push({ OR: fallbackConditions })
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
      
      // Combine category filter with existing conditions
      // Since we're using AND structure for text search, add category to AND as well
      if (where.AND && Array.isArray(where.AND) && where.AND.length > 0) {
        // We already have AND conditions (city filter and/or text search), add category
        where.AND.push({ OR: categoryConditions })
      } else if (where.OR && Array.isArray(where.OR) && where.OR.length > 0) {
        // Legacy: if we somehow have OR conditions, convert to AND structure
        const textSearchOR = where.OR
        delete where.OR
        where.AND = [
          { OR: textSearchOR },
          { OR: categoryConditions },
        ]
      } else {
        // No text search or city filter, just filter by category
        where.AND = where.AND || []
        where.AND.push({ OR: categoryConditions })
      }
    }

    console.log("[v0] Final where clause:", JSON.stringify(where, null, 2))
    console.log("[v0] Search query breakdown:", {
      originalQuery: q,
      cleanedQuery,
      queryWords: cleanedQuery ? cleanedQuery.split(/\s+/).filter(w => w.length > 0) : [],
      cityFilter: city,
      countryFilter: country,
      categoryFilter: category,
      dateFrom,
      dateTo,
      publicEventWhere: PUBLIC_EVENT_WHERE,
    })
    
    // Debug: Check if we're filtering by city and what variations we're using
    if (city) {
      const cityLower = city.toLowerCase().trim()
      const cityVariations: Record<string, string[]> = {
        "brussels": ["bruxelles", "brussel", "bruselas"],
        "athens": ["αθήνα", "athina", "athen"],
        "rome": ["roma", "rom"],
      }
      const variations = cityVariations[cityLower] || []
      console.log(`[v0] City filter will match: ${city} and variations: [${variations.join(", ")}]`)
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

    console.log("[v0] Search query:", q, "filters:", { city, country, category, dateFrom, dateTo }, "found:", count, "internal events")
    if (count === 0 && q) {
      console.log("[v0] ⚠️ No internal events found for query. Possible reasons:")
      console.log("  - Event doesn't match text search terms (title/description)")
      console.log("  - Event moderationStatus is not APPROVED")
      console.log("  - Event status is not PUBLISHED")
      console.log("  - Event date is in the past")
      if (city) console.log(`  - Event city doesn't match filter: "${city}"`)
      if (country) console.log(`  - Event country doesn't match filter: "${country}"`)
    }

    // EVENT-INTENT QUERY BEHAVIOR:
    // For event-intent queries with location set, automatically fetch web results if no internal events found
    // This provides local event discovery while maintaining strict location constraints
    let webResults: any[] = []
    let debugTrace: any = {
      internalCount: events.length,
      webCalled: false,
      webQuery: null,
      webRawCount: 0,
      webAfterLocationCount: 0,
      webAfterEventinessCount: 0,
      webAfterDateCount: 0,
      finalReturnedInternalCount: 0,
      finalReturnedWebCount: 0,
      webError: null,
      sampleWebTitles: [],
    }
    
    // GUARANTEE: If internal results count is 0 and location is known, web search MUST run
    // Decide if we should search web:
    // 1. Always search web for non-event queries (current behavior)
    // 2. For event-intent queries: only search web if no internal events found (automatic fallback)
    // 3. Location must be set for event-intent queries to use web fallback
    const shouldSearchWeb = q.trim().length > 0 && (
      !isEventQuery || // Non-event queries: always search web
      (isEventQuery && events.length === 0 && (city || country)) // Event-intent with no internal events AND location set: auto-fallback
    )
    
    // CRITICAL: If internal is 0 and location is set, web search MUST be called
    if (events.length === 0 && (city || country) && q.trim().length > 0 && !shouldSearchWeb) {
      console.warn(`[v0] ⚠️ WARNING: Internal results empty, location set (${city || ''}, ${country || ''}), but web search not triggered!`)
    }
    
    if (isEventQuery && events.length === 0 && shouldSearchWeb) {
      console.log(`[v0] 🔄 Event-intent query with no internal events: automatically fetching web results (location: ${city || 'none'}${country ? `, ${country}` : ''})`)
    } else if (isEventQuery && events.length > 0) {
      console.log(`[v0] ✅ Event-intent query: ${events.length} internal events found, skipping web search`)
    }
    
    if (shouldSearchWeb) {
      debugTrace.webCalled = true
      const hasGoogleConfig = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_PSE_ID)
      console.log("[v0] Searching web...", { 
        hasGoogleConfig, 
        hasApiKey: !!process.env.GOOGLE_API_KEY, 
        hasPseId: !!process.env.GOOGLE_PSE_ID 
      })
      
      try {
        // Build web search query using LOCATION CONTROL (city/country from params, not query extraction)
        // CRITICAL: Use city/country from URL params (set by UI location picker), not from query text
        let webQuery = q
        
        // ALWAYS add city if provided in params (from UI location picker)
        if (city) {
          const cityLower = city.toLowerCase().trim()
          // Add city if not already in query
          if (!webQuery.toLowerCase().includes(cityLower)) {
            webQuery = `${webQuery} ${city}`
          }
          
          // Add country for ambiguous cities to improve Google search accuracy
          // Use country from params if available, otherwise use defaults for ambiguous cities
          if (country) {
            const countryLower = country.toLowerCase()
            if (!webQuery.toLowerCase().includes(countryLower)) {
              webQuery = `${webQuery} ${country}`
            }
          } else {
            // No country in params, use defaults for ambiguous cities
            const ambiguousCities: Record<string, string> = {
              "melbourne": "Australia",
              "ithaca": "",
              "ithaki": "Greece",
              "cambridge": "",
              "naples": "Italy",
              "berlin": "Germany",
              "paris": "France",
              "london": "UK",
              "rome": "Italy",
              "athens": "Greece",
              "milan": "Italy",
              "vienna": "Austria",
              "madrid": "Spain",
            }
            if (ambiguousCities[cityLower]) {
              webQuery = `${webQuery} ${ambiguousCities[cityLower]}`
            }
          }
        } else if (country && !webQuery.toLowerCase().includes(country.toLowerCase())) {
          // City not in params, but country is - add it
          webQuery = `${webQuery} ${country}`
        }
        
        if (category && category !== "all" && !webQuery.toLowerCase().includes(category.toLowerCase())) {
          webQuery = `${webQuery} ${category}`
        }
        // Add "events" to improve search results
        if (!webQuery.toLowerCase().includes("event")) {
          webQuery = `${webQuery} events`
        }
        
        const finalWebQuery = webQuery.trim()
        debugTrace.webQuery = finalWebQuery
        console.log("[v0] Web search query:", finalWebQuery)
        
        const webSearchResults = await searchWeb({
          query: finalWebQuery,
          limit: 10,
        })
        
        debugTrace.webRawCount = webSearchResults.length
        
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
        // NOTE: Web search already filtered by city in the query, so we only need to exclude obvious mismatches
        // Don't require city to appear in every result's text - trust Google's search relevance
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
          
          // US cities to exclude when searching from Australia
          const knownUSCities = [
            "fort worth", "austin", "seneca", "dallas", "houston", "boston", "kansas city", "phoenix",
            "chicago", "los angeles", "new york", "san francisco", "seattle", "denver", "miami",
            "atlanta", "philadelphia", "san diego", "detroit", "minneapolis", "portland", "orlando"
          ]
          
          // US states to check for
          const usStates = [
            "texas", "california", "florida", "new york", "pennsylvania", "illinois", "ohio", "georgia",
            "north carolina", "michigan", "new jersey", "virginia", "washington", "arizona", "massachusetts"
          ]
          
          const isAmbiguous = ambiguousCities[cityLower] !== undefined
          const expectedCountries = isAmbiguous ? ambiguousCities[cityLower] : []
          const countryLower = country ? country.toLowerCase().trim() : null
          
          transformedWebResults = transformedWebResults.filter((result) => {
            // Build comprehensive text from all result fields
            const resultText = `${result.title || ""} ${result.description || ""} ${result.city || ""} ${result.country || ""} ${result.location?.city || ""} ${result.location?.country || ""} ${result.address || ""} ${result.venueName || ""} ${result.url || ""}`.toLowerCase()
            
            // HARD FILTER #1: If searching from Australia, exclude ANY result mentioning US cities/states
            if (countryLower && countryLower.includes("australia")) {
              // Check for known US cities
              const mentionsUSCity = knownUSCities.some(usCity => {
                if (usCity === cityLower) return false // Don't exclude if it's the target city
                const usCityRegex = new RegExp(`\\b${usCity.replace(/\s+/g, '\\s+')}\\b`, "i")
                return usCityRegex.test(resultText)
              })
              
              if (mentionsUSCity) {
                console.log(`[v0] 🚫 EXCLUDED from /api/search/events: US city detected in "${result.title?.substring(0, 50)}" when searching from Australia`)
                return false
              }
              
              // Check for US state mentions
              const mentionsUSState = usStates.some(state => {
                const stateRegex = new RegExp(`\\b${state}\\b`, "i")
                return stateRegex.test(resultText)
              })
              
              if (mentionsUSState) {
                console.log(`[v0] 🚫 EXCLUDED from /api/search/events: US state detected in "${result.title?.substring(0, 50)}" when searching from Australia`)
                return false
              }
              
              // Check for US country indicators without Australia indicators
              const hasUSIndicators = /\b(usa|united states|us|america|u\.s\.|u\.s\.a\.)\b/i.test(resultText)
              
              if (hasUSIndicators && !hasAustraliaIndicators(resultText)) {
                console.log(`[v0] 🚫 EXCLUDED from /api/search/events: US indicators found but no Australia indicators in "${result.title?.substring(0, 50)}"`)
                return false
              }
            }
            
            // RELAXED FILTERING: Only exclude if explicitly mentions a different major city
            // Since web search already filtered by city in the query, we trust Google's relevance
            // Only filter out obvious mismatches (different cities, wrong country for ambiguous cities)
            if (isAmbiguous && countryLower) {
              // For ambiguous cities with country specified, exclude if result mentions wrong country
              const wrongCountryMatch = expectedCountries.some((expectedCountry) => {
                const expectedLower = expectedCountry.toLowerCase()
                // If we're searching for Melbourne, Australia, exclude if result mentions Florida/USA
                if (expectedLower.includes("australia") && /\b(florida|fl|usa|united states|us|america)\b/i.test(resultText)) {
                  // But allow if it also mentions Australia/Melbourne (might be a comparison or list)
                  return !hasAustraliaIndicators(resultText) || !resultText.includes(cityLower)
                }
                return false
              })
              
              if (wrongCountryMatch) {
                console.log(`[v0] 🚫 EXCLUDED: Wrong country variant for ambiguous city "${city}" in "${result.title?.substring(0, 50)}"`)
                return false
              }
            }
            
            // Allow all results that pass the negative filters above
            // Don't require city to appear in result text - web search query already filtered by city
            return true
          })
          
          if (beforeCityFilter !== transformedWebResults.length) {
            console.log(`[v0] Filtered web results by city "${city}": ${beforeCityFilter} -> ${transformedWebResults.length}`)
          }
        }

        webResults = transformedWebResults
        debugTrace.webAfterLocationCount = webResults.length
        debugTrace.sampleWebTitles = webResults.slice(0, 3).map(r => r.title || "")
        
        console.log("[v0] Web search found:", webResults.length, "events after location filtering")
      } catch (error: any) {
        debugTrace.webError = error?.message || String(error)
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

    // Filter web results: exclude past events ONLY if date is parseable
    // CRITICAL: Don't drop web results solely because date is missing
    // Gig guides/listing pages often don't have parseable dates but are still valid event sources
    let filteredWebResults = webResults.filter((result) => {
      // Only filter by date if date is present and parseable
      if (result.startAt) {
        try {
          const eventDate = new Date(result.startAt)
          // Only exclude if date is valid AND in the past
          if (!isNaN(eventDate.getTime()) && eventDate < now) {
            return false // Exclude past events (only if date is valid)
          }
          // If date is invalid/unparseable, keep the result (gig guides often have unparseable dates)
        } catch {
          // Invalid date format - keep the result (don't drop for missing date)
        }
      }
      // No date or unparseable date - keep the result (web fallback should be lenient)
      return true
    })
    
    debugTrace.webAfterDateCount = filteredWebResults.length
    
    // STRICT LOCATION FILTER: Apply city/country filter if specified
    // This is a second pass to ensure absolute strictness - no results from other cities/countries
    if (city) {
      const cityLower = city.toLowerCase().trim()
      const countryLower = country ? country.toLowerCase().trim() : null
      const beforeCityFilter = filteredWebResults.length
      
      // Known US cities to exclude when searching from Australia (same list as earlier)
      const knownUSCities = [
        "fort worth", "austin", "seneca", "dallas", "houston", "boston", "kansas city", "phoenix",
        "chicago", "los angeles", "new york", "san francisco", "seattle", "denver", "miami",
        "atlanta", "philadelphia", "san diego", "detroit", "minneapolis", "portland", "orlando",
        "las vegas", "nashville", "cleveland", "tampa", "sacramento", "oakland", "omaha"
      ]
      
      // US states to check
      const usStates = [
        "texas", "california", "florida", "new york", "pennsylvania", "illinois", "ohio", "georgia",
        "north carolina", "michigan", "new jersey", "virginia", "washington", "arizona", "massachusetts",
        "tennessee", "indiana", "missouri", "maryland", "wisconsin", "colorado", "minnesota", "south carolina"
      ]
      
      filteredWebResults = filteredWebResults.filter((result) => {
        // Build comprehensive text from all result fields for strict checking
        const resultText = `${result.title || ""} ${result.description || ""} ${result.city || ""} ${result.country || ""} ${result.location?.city || ""} ${result.location?.country || ""} ${result.address || ""} ${result.venueName || ""}`.toLowerCase()
        
        // STRICT FILTER #1: If searching from Australia, exclude ANY result mentioning US cities/states
        if (countryLower && countryLower.includes("australia")) {
          const mentionsUSCity = knownUSCities.some(usCity => {
            if (usCity === cityLower) return false // Don't exclude if it's the target city
            const usCityRegex = new RegExp(`\\b${usCity.replace(/\s+/g, '\\s+')}\\b`, "i")
            return usCityRegex.test(resultText)
          })
          
          if (mentionsUSCity) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded US city in "${result.title?.substring(0, 50)}" when searching from Australia`)
            return false
          }
          
          const mentionsUSState = usStates.some(state => {
            const stateRegex = new RegExp(`\\b${state}\\b`, "i")
            return stateRegex.test(resultText)
          })
          
          if (mentionsUSState) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded US state in "${result.title?.substring(0, 50)}" when searching from Australia`)
            return false
          }
          
          // Check for US country indicators without Australia indicators
          const hasUSIndicators = /\b(usa|united states|us|america|u\.s\.|u\.s\.a\.)\b/i.test(resultText)
          
          if (hasUSIndicators && !hasAustraliaIndicators(resultText)) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded US indicators (no Australia) in "${result.title?.substring(0, 50)}"`)
            return false
          }
        }
        
        // RELAXED FILTERING: Web search already filtered by city in the query
        // Only exclude obvious mismatches - don't require city/country in result text
        // Trust Google's search relevance since we searched for "query city events"
        
        // Only exclude if explicitly mentions a different major city AND it's clearly wrong
        const otherMajorCities = ["sydney", "brisbane", "perth", "adelaide", "canberra", "darwin", 
          "new york", "los angeles", "london", "paris", "tokyo", "toronto"]
        if (cityLower !== "melbourne" || countryLower?.includes("australia")) {
          // Only check for other cities if it's NOT about the target city at all
          const mentionsOtherCity = otherMajorCities.some(otherCity => {
            if (otherCity === cityLower) return false
            const otherCityRegex = new RegExp(`\\b${otherCity}\\b`, "i")
            const mentionsTargetCity = resultText.includes(cityLower)
            // Exclude only if mentions other city AND doesn't mention target city
            return otherCityRegex.test(resultText) && !mentionsTargetCity
          })
          
          if (mentionsOtherCity) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded result mentioning different major city in "${result.title?.substring(0, 50)}"`)
            return false
          }
        }
        
        // Allow all results - web search query already filtered by city
        return true
      })
      
      if (beforeCityFilter !== filteredWebResults.length) {
        console.log(`[v0] STRICT location filter applied: ${beforeCityFilter} → ${filteredWebResults.length} web results (city: "${city}"${country ? `, country: "${country}"` : ""})`)
      }
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
    const externalEventsUnranked = filteredWebResults.map((e: any) => ({
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
    
    // EVENT-FIRST RANKING: Apply event-first ranking to web results
    // This prioritizes actual, specific events over aggregators/directories
    // Ranking only applies to event-intent queries (detected automatically)
    // Note: isEventQuery is already defined at the top of the function
    
    if (isEventQuery) {
      console.log(`[v0] 🎯 Event-intent query detected: "${q}" - applying event-first ranking to web results`)
    }
    
    // Rank external events using event-first scoring
    // This will:
    // - Boost specific events with dates, venues, locations (+5, +4, +3)
    // - Penalize aggregators/directories (-5)
    // - Penalize wrong country (-6)
    // - Penalize venue homepages without events (-3)
    const externalEvents = rankEventResults(
      externalEventsUnranked,
      q,
      city || undefined,
      country || undefined
    )
    
    debugTrace.webAfterEventinessCount = externalEvents.length
    
    if (isEventQuery && externalEvents.length > 0) {
      console.log(`[v0] ✅ Event-first ranking applied to ${externalEvents.length} web results`)
      // Enable detailed ranking logs
      process.env.LOG_RANKING = 'true'
    }
    
    // EVENT-INTENT QUERY BEHAVIOR:
    // 1. Always return internal Eventa events first
    // 2. Automatically include web results if no internal events found (for event-intent queries)
    // 3. Empty state only if both internal events = 0 AND web events (after strict filtering) = 0
    
    const allEvents = [...internalEvents, ...externalEvents]
    
    debugTrace.finalReturnedInternalCount = internalEvents.length
    debugTrace.finalReturnedWebCount = externalEvents.length
    
    // Determine if we should return empty state flag
    // Empty state = event-intent query + no internal events + no web events (after strict filtering)
    const isEmptyState = isEventQuery && events.length === 0 && externalEvents.length === 0

    if (isEmptyState) {
      console.log(`[v0] 📭 Empty state: event-intent query with no internal events and no web events found (after strict location filtering)`)
    } else if (isEventQuery && events.length === 0 && externalEvents.length > 0) {
      console.log(`[v0] ✅ Web fallback successful: ${externalEvents.length} local web events found for event-intent query`)
    }

    const allExternal = [...externalEvents, ...stubExternalEvents]

    const response: any = {
      events: allEvents,
      count: allEvents.length,
      page,
      take,
      query: q,
      internal: events,
      external: allExternal,
      total: allEvents.length,
      // Empty state flag: true only if both internal and web events are 0
      emptyState: isEmptyState,
      // Indicate if web results were included (for UI labeling)
      includesWeb: externalEvents.length > 0,
      // Indicate if this is an event-intent query
      isEventIntent: isEventQuery,
    }
    
    // Add debug trace if ?debug=1
    if (debug) {
      response.debugTrace = debugTrace
    }

    return NextResponse.json(response)
  } catch (e: any) {
    const errorMessage = e?.message || String(e)
    const errorStack = e?.stack
    console.error("[v0] search/events error:", errorMessage)
    if (errorStack) {
      console.error("[v0] search/events error stack:", errorStack.substring(0, 500)) // Limit stack trace length
    }
    
    // Check for database/Prisma errors
    if (errorMessage.includes("column") || errorMessage.includes("does not exist") || errorMessage.includes("prisma") || errorMessage.includes("database")) {
      console.error("[v0] ⚠️ Database schema error detected - this might be a migration issue")
      console.error("[v0] Error details:", {
        message: errorMessage,
        query: q,
        city,
        country,
      })
    }
    
    // Return error response with details in development
    return NextResponse.json(
      {
        events: [],
        count: 0,
        internal: [],
        external: [],
        total: 0,
        emptyState: false,
        includesWeb: false,
        isEventIntent: false,
        error: process.env.NODE_ENV === "development" ? errorMessage : "Search failed",
        ...(process.env.NODE_ENV === "development" && { errorDetails: errorStack?.substring(0, 500) }),
      },
      { status: 500 },
    )
  }
}
