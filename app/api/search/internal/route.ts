import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { DateTime } from "luxon"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"
import { searchDatabase } from "@/lib/search/database-search"
import { normalizeQuery } from "@/lib/search/query-normalization"
import { detectLanguage } from "@/lib/search/language-detection"
import { withLanguageColumnGuard } from "@/lib/db-runtime-guard"

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let errorCode: string | null = null

  try {
    const body = await request.json()
    const { entities = {}, query, uiLang = "en" } = body

    console.log(`[v0] Internal search request - uiLang: ${uiLang}`, { entities, query })
    console.log(`[v0] Extracted entities:`, {
      city: entities.city,
      date: entities.date,
      date_iso: entities.date_iso,
      type: entities.type,
      category: entities.category,
      venue: entities.venue,
    })

    // Ensure query exists for search
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      console.log("[v0] No query provided, returning empty results")
      const latency = Date.now() - startTime
      
      console.log(
        JSON.stringify({
          phase: "2",
          intent: "SEARCH",
          entities: {},
          input_mode: "text",
          search: {
            source: "internal",
            query_string: "",
            results_count: 0,
            latency_ms: latency,
          },
          error_code: "ERR_EMPTY_QUERY",
        }),
      )
      
      return NextResponse.json({
        results: [],
        count: 0,
        latency_ms: latency,
        error_code: "ERR_EMPTY_QUERY",
      })
    }

    // Parse date filter from entities
    let dateFilter: { gte?: Date; lte?: Date } | undefined
    
    // Helper function to parse duration from query
    const parseDuration = (text: string): number => {
      const lower = text.toLowerCase()
      // Match patterns like "for one week", "for 1 week", "stay for 7 days", etc.
      const weekMatch = lower.match(/(?:for|stay\s+for|will\s+stay\s+for)\s+(?:one|1|a)\s+week/i)
      if (weekMatch) return 7
      
      const daysMatch = lower.match(/(?:for|stay\s+for|will\s+stay\s+for)\s+(\d+)\s+days?/i)
      if (daysMatch) return parseInt(daysMatch[1], 10)
      
      const weeksMatch = lower.match(/(?:for|stay\s+for|will\s+stay\s+for)\s+(\d+)\s+weeks?/i)
      if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7
      
      return 7 // Default to 1 week if no duration found
    }
    
    // Priority: use date_iso if available (for specific dates like "30 April 2026")
    if (entities.date_iso) {
      try {
        const startDate = DateTime.fromISO(entities.date_iso).startOf("day")
        if (startDate.isValid) {
          // Parse duration from query if available
          const durationDays = query ? parseDuration(query) : 7
          const endDate = startDate.plus({ days: durationDays }).endOf("day")
          dateFilter = {
            gte: startDate.toJSDate(),
            lte: endDate.toJSDate(),
          }
          console.log(`[v0] Using date_iso: ${entities.date_iso}, duration: ${durationDays} days, range: ${startDate.toISODate()} to ${endDate.toISODate()}`)
        }
      } catch (error) {
        console.warn(`[v0] Failed to parse date_iso: ${entities.date_iso}`, error)
      }
    }
    
    // Fallback to parsing natural language date
    if (!dateFilter && entities.date) {
      dateFilter = parseDatePhrase(entities.date)
    }

    // Use full-text search if query is provided
    let searchResults: any[] = []
    let eventIds: string[] = []

    if (query && query.trim().length > 0) {
      // Normalize query for full-text search
      const langDetected = detectLanguage(query)
      const normalized = normalizeQuery(query, langDetected)

      // Build search filters from entities
      const searchFilters: { dateRange?: "today" | "weekend" | "month" | "all" } = {}
      
      // Only convert date filter to dateRange format for relative dates (today, weekend, etc.)
      // For specific dates (like "30 April 2026"), skip dateRange conversion and rely on WHERE clause filtering
      if (dateFilter && !entities.date_iso) {
        // Only convert relative dates, not specific calendar dates
        const now = DateTime.now()
        if (dateFilter.gte && dateFilter.lte) {
          const start = DateTime.fromJSDate(dateFilter.gte)
          const end = DateTime.fromJSDate(dateFilter.lte)
          const daysDiff = end.diff(start, "days").days
          
          // Only use dateRange for near-term relative dates
          const daysFromNow = start.diff(now, "days").days
          if (daysFromNow <= 7 && daysDiff <= 1) {
            searchFilters.dateRange = "today"
          } else if (daysFromNow <= 7 && daysDiff <= 2) {
            searchFilters.dateRange = "weekend"
          } else if (daysFromNow <= 30) {
            searchFilters.dateRange = "month"
          }
          // For dates far in the future (like 2026), don't set dateRange - rely on WHERE clause
        } else if (dateFilter.gte) {
          const start = DateTime.fromJSDate(dateFilter.gte)
          const daysFromNow = start.diff(now, "days").days
          if (daysFromNow <= 30) {
            searchFilters.dateRange = "month"
          }
        }
      }

      // Collect categories for searchDatabase
      const categories: string[] = []
      if (normalized.categories.length > 0) {
        categories.push(...normalized.categories)
      }
      if (entities.type || entities.category) {
        const searchCategory = entities.type || entities.category
        if (searchCategory) {
          categories.push(searchCategory)
        }
      }

      // Perform full-text search
      const fullTextResults = await searchDatabase({
        query: normalized.normalized,
        synonyms: normalized.synonyms,
        categories: categories,
        filters: Object.keys(searchFilters).length > 0 ? searchFilters : undefined,
        limit: 50, // Get more results to filter by entities
      })

      eventIds = fullTextResults.map((r) => r.id!).filter(Boolean)
      console.log(`[v0] Full-text search found ${eventIds.length} events`)
      
      if (eventIds.length === 0) {
        console.log("[v0] Full-text search returned no results, will try entity-only search if entities provided")
      }
    } else {
      console.log("[v0] No query provided, will search by entities only if provided")
    }

    // Build where clause for fetching full event objects
    const where: any = {
      ...PUBLIC_EVENT_WHERE,
      moderationStatus: "APPROVED", // Keep for backward compatibility
    }
    
    // Apply date filter - use wider range for better results
    if (dateFilter) {
      // Expand the date range slightly to catch events near the requested range
      const rangeStart = dateFilter.gte ? DateTime.fromJSDate(dateFilter.gte) : null
      const rangeEnd = dateFilter.lte ? DateTime.fromJSDate(dateFilter.lte) : null
      
      if (rangeStart && rangeEnd) {
        // Expand range by 7 days on each side for better coverage
        const expandedStart = rangeStart.minus({ days: 7 }).startOf("day")
        const expandedEnd = rangeEnd.plus({ days: 7 }).endOf("day")
        
        where.startAt = {
          gte: expandedStart.toJSDate(),
          lte: expandedEnd.toJSDate(),
        }
        console.log(`[v0] Applying expanded date filter:`, {
          requested: {
            gte: rangeStart.toISOString(),
            lte: rangeEnd.toISOString(),
          },
          expanded: {
            gte: expandedStart.toISOString(),
            lte: expandedEnd.toISOString(),
          },
        })
      } else if (rangeStart) {
        where.startAt = { gte: rangeStart.minus({ days: 7 }).toJSDate() }
      }
    } else {
      // Default: only show future events
      where.startAt = { gte: new Date() }
    }

    // If we have full-text search results, filter by those IDs
    // This ensures we only get events that matched the full-text search
    if (eventIds.length > 0) {
      where.id = { in: eventIds }
    }

    // Build OR conditions for venue and category
    const orConditions: any[] = []

    // Venue filter
    if (entities?.venue) {
      orConditions.push(
        { venueName: { contains: entities.venue, mode: "insensitive" } },
        { locationAddress: { contains: entities.venue, mode: "insensitive" } }
      )
    }

    // Category filter
    if (entities?.type || entities?.category) {
      const searchCategory = entities.type || entities.category
      const categoryEnum = mapToEventCategory(searchCategory)

      if (categoryEnum) {
        orConditions.push({ category: categoryEnum })
      }
      if (searchCategory) {
        orConditions.push({ categories: { hasSome: [searchCategory, categoryEnum].filter(Boolean) } })
      }
    }

    // Add OR conditions if any exist
    if (orConditions.length > 0) {
      where.OR = orConditions
    }

    // City filter (applied separately as it's not part of OR)
    // Use contains for flexibility but add post-filtering to exclude ambiguous matches
    if (entities?.city) {
      const cityName = entities.city.trim()
      const cityLower = cityName.toLowerCase()
      
      // Use contains to handle variations in city name formatting
      where.city = {
        contains: cityName,
        mode: "insensitive",
      }
      console.log(`[v0] Filtering by city: ${cityName} (using contains for flexibility)`)
      
      // If country is also specified, filter by country to disambiguate cities with the same name
      if (entities?.country) {
        const countryName = entities.country.trim()
        // Normalize country names for matching
        const countryNormalized = countryName.toLowerCase()
        // Handle common variations
        const countryVariations: Record<string, string[]> = {
          "united states": ["usa", "us", "united states", "america"],
          "greece": ["greece", "greek"],
          "italy": ["italy", "italian"],
          "spain": ["spain", "spanish"],
          "france": ["france", "french"],
          "united kingdom": ["uk", "united kingdom", "britain", "british"],
        }
        
        // Find matching country variation
        let matchedCountry: string | null = null
        for (const [standard, variations] of Object.entries(countryVariations)) {
          if (variations.some(v => countryNormalized.includes(v) || v.includes(countryNormalized))) {
            matchedCountry = standard
            break
          }
        }
        
        if (matchedCountry) {
          where.country = {
            contains: matchedCountry,
            mode: "insensitive",
          }
          console.log(`[v0] Also filtering by country: ${matchedCountry} (from extracted: ${countryName}) to disambiguate city: ${cityName}`)
        } else {
          // Try direct match
          where.country = {
            contains: countryName,
            mode: "insensitive",
          }
          console.log(`[v0] Also filtering by country: ${countryName} (direct match) to disambiguate city: ${cityName}`)
        }
      }
      
      // Note: We'll do additional filtering after fetching to exclude ambiguous matches
      // like "Berlin Maryland" when searching for "Berlin"
    } else {
      console.log(`[v0] No city filter applied (entities.city: ${entities?.city})`)
    }

    // Log date filter application
    if (dateFilter) {
      console.log(`[v0] Applying date filter to WHERE clause:`, {
        gte: dateFilter.gte?.toISOString(),
        lte: dateFilter.lte?.toISOString(),
      })
    } else {
      console.log(`[v0] No date filter applied (dateFilter is null/undefined)`)
    }

    console.log("[v0] Search query where clause:", JSON.stringify(where, null, 2))
    console.log(`[v0] Searching with: query="${query}", eventIds=${eventIds.length}, entities=`, entities)

    // Execute search - fetch full event objects
    let events
    try {
      events = await withLanguageColumnGuard(() => db.event.findMany({
        where,
        orderBy: [{ startAt: "asc" }],
        take: 50, // Get more results initially
      }))
    } catch (error: any) {
      // If language column is missing, return empty results
      // The warning has already been logged by withLanguageColumnGuard
      console.error("[SEARCH FALLBACK] Query failed, returning empty results:", error?.message)
      events = []
    }

    console.log(`[v0] Found ${events.length} events after initial filtering`)

    // If no results with strict filtering and we have a date filter, try without date filter
    if (events.length === 0 && dateFilter && eventIds.length === 0) {
      console.log("[v0] No results with date filter, trying without date filter")
      const fallbackWhere = { ...where }
      delete fallbackWhere.startAt
      fallbackWhere.startAt = { gte: new Date() } // Only future events
      
      try {
        events = await withLanguageColumnGuard(() => db.event.findMany({
          where: fallbackWhere,
          orderBy: [{ startAt: "asc" }],
          take: 50,
        }))
      } catch (error: any) {
        console.error("[SEARCH FALLBACK] Fallback query failed:", error?.message)
        events = []
      }
      console.log(`[v0] Fallback search found ${events.length} events`)
    }

    // Post-filter to exclude ambiguous city matches (e.g., "Berlin Maryland" when searching for "Berlin")
    if (entities?.city && events.length > 0) {
      const cityLower = entities.city.toLowerCase().trim()
      const cityWords = cityLower.split(/\s+/)
      const majorCities = ["berlin", "paris", "london", "rome", "madrid", "athens", "milan", "vienna", "amsterdam", "barcelona"]
      
      events = events.filter((event) => {
        const eventCity = (event.city || "").toLowerCase().trim()
        const eventCountry = (event.country || "").toLowerCase().trim()
        const eventAddress = (event.address || "").toLowerCase()
        
        // Check if city matches exactly or as a standalone word
        const cityRegex = new RegExp(`\\b${cityLower}\\b`, "i")
        const matchesCity = cityRegex.test(eventCity)
        
        if (!matchesCity) return false
        
        // For major cities, exclude US state matches unless country is explicitly mentioned
        if (majorCities.includes(cityLower)) {
          const hasUSState = /\b(maryland|md|california|ca|texas|tx|new york|ny|florida|fl|ohio|oh|pennsylvania|pa)\b/i.test(eventCity + " " + eventAddress)
          const hasUSCountry = /\b(usa|united states|us|america)\b/i.test(eventCountry + " " + eventAddress)
          
          // If it's a US state but no country mentioned or country is not US, exclude it
          if (hasUSState && !hasUSCountry) {
            return false
          }
        }
        
        return true
      })
      
      console.log(`[v0] Post-filtered by city: ${events.length} events remaining`)
    }

    // If no results from full-text search but we have entity filters, try entity-only search
    if (events.length === 0 && eventIds.length === 0 && (entities.city || entities.venue || entities.type || entities.category)) {
      console.log("[v0] No full-text results, trying entity-only search")
      const fallbackWhere: any = {
        ...PUBLIC_EVENT_WHERE,
        moderationStatus: "APPROVED",
        startAt: dateFilter || { gte: new Date() },
      }

      if (entities.city) {
        fallbackWhere.city = { contains: entities.city, mode: "insensitive" }
      }

      if (entities.venue) {
        fallbackWhere.OR = [
          { venueName: { contains: entities.venue, mode: "insensitive" } },
          { locationAddress: { contains: entities.venue, mode: "insensitive" } },
        ]
      }

      if (entities.type || entities.category) {
        const searchCategory = entities.type || entities.category
        const categoryEnum = mapToEventCategory(searchCategory)
        fallbackWhere.OR = [
          ...(fallbackWhere.OR || []),
          { category: categoryEnum },
          { categories: { hasSome: [searchCategory, categoryEnum].filter(Boolean) } },
        ]
      }

      let fallbackEvents
      try {
        fallbackEvents = await withLanguageColumnGuard(() => db.event.findMany({
          where: fallbackWhere,
          orderBy: [{ startAt: "asc" }],
          take: 20,
        }))
      } catch (error: any) {
        console.error("[SEARCH FALLBACK] Fallback query failed:", error?.message)
        fallbackEvents = []
      }
      
      if (fallbackEvents.length > 0) {
        events = fallbackEvents
        
        // Apply same city filtering to fallback results
        if (entities?.city) {
          const cityLower = entities.city.toLowerCase().trim()
          const majorCities = ["berlin", "paris", "london", "rome", "madrid", "athens", "milan", "vienna", "amsterdam", "barcelona"]
          
          events = events.filter((event) => {
            const eventCity = (event.city || "").toLowerCase().trim()
            const eventCountry = (event.country || "").toLowerCase().trim()
            const eventAddress = (event.address || "").toLowerCase()
            
            const cityRegex = new RegExp(`\\b${cityLower}\\b`, "i")
            const matchesCity = cityRegex.test(eventCity)
            
            if (!matchesCity) return false
            
            if (majorCities.includes(cityLower)) {
              const hasUSState = /\b(maryland|md|california|ca|texas|tx|new york|ny|florida|fl|ohio|oh|pennsylvania|pa)\b/i.test(eventCity + " " + eventAddress)
              const hasUSCountry = /\b(usa|united states|us|america)\b/i.test(eventCountry + " " + eventAddress)
              
              if (hasUSState && !hasUSCountry) {
                return false
              }
            }
            
            return true
          })
        }
      }
    }

    searchResults = events

    // Rank and score events with balanced matching
    const rankedEvents = searchResults.map((event) => {
      let score = 0
      const searchTerms = [query, entities.title, entities.type, entities.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 1) // Allow shorter terms (changed from > 2)

      // Title match - prioritize but allow partial matches
      const titleLower = event.title.toLowerCase()
      if (searchTerms.length > 0) {
        const exactPhraseMatch = query && titleLower.includes(query.toLowerCase())
        const allTermsMatch = searchTerms.every(term => titleLower.includes(term))
        const matchedTerms = searchTerms.filter(term => titleLower.includes(term)).length
        const matchRatio = matchedTerms / searchTerms.length
        
        if (exactPhraseMatch) {
          score += 8 // Exact phrase match in title
        } else if (allTermsMatch) {
          score += 6 // All search terms found in title
        } else if (matchRatio >= 0.5) {
          score += 4 * matchRatio // Good partial match (50%+ terms)
        } else if (matchRatio > 0) {
          score += 2 * matchRatio // Some terms match
        }
      }

      // Category match - more lenient
      const eventCategories = [...(event.categories || []), event.category].filter(Boolean)
      const categoryMatch = entities.type || entities.category
      if (categoryMatch) {
        const categoryLower = categoryMatch.toLowerCase()
        const hasExactCategory = eventCategories.some(
          cat => cat && cat.toLowerCase() === categoryLower
        )
        const hasPartialCategory = eventCategories.some(
          cat => cat && (categoryLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(categoryLower))
        )
        
        if (hasExactCategory) {
          score += 4 // Exact category match
        } else if (hasPartialCategory) {
          score += 2 // Partial category match (more lenient)
        }
      }

      // Description match - boost for relevant content
      if (searchTerms.length > 0 && event.description) {
        const descLower = event.description.toLowerCase()
        const matchedTerms = searchTerms.filter(term => descLower.includes(term)).length
        const matchRatio = matchedTerms / searchTerms.length
        if (matchRatio > 0) {
          score += 2 * matchRatio // Proportional to match quality
        }
      }

      // City match - important for location-based searches
      if (entities.city) {
        const cityLower = entities.city.toLowerCase().trim()
        const eventCity = event.city?.toLowerCase().trim()
        if (eventCity === cityLower) {
          score += 4 // Exact city match
        } else if (eventCity?.includes(cityLower) || cityLower.includes(eventCity || "")) {
          score += 2 // Partial city match
        }
      }

      // Date relevance scoring - critical for date-filtered searches
      if (dateFilter) {
        const eventDate = DateTime.fromJSDate(event.startAt)
        const eventStart = eventDate.startOf("day")
        
        const rangeStart = dateFilter.gte ? DateTime.fromJSDate(dateFilter.gte).startOf("day") : null
        const rangeEnd = dateFilter.lte ? DateTime.fromJSDate(dateFilter.lte).endOf("day") : null
        
        if (rangeStart && rangeEnd) {
          if (eventStart >= rangeStart && eventStart <= rangeEnd) {
            score += 12 // Strong boost for events in the requested range
          } else {
            const daysOutside = eventStart < rangeStart 
              ? rangeStart.diff(eventStart, "days").days
              : eventStart.diff(rangeEnd, "days").days
            
            // Reduced penalties - still prioritize in-range but don't eliminate close matches
            if (daysOutside <= 3) {
              score -= 3 // Slightly outside range - small penalty
            } else if (daysOutside <= 7) {
              score -= 6 // Moderately outside range
            } else if (daysOutside <= 30) {
              score -= 10 // Further outside range
            } else {
              score -= 20 // Far outside range - reduced from 50
            }
          }
        } else if (rangeStart) {
          if (eventStart >= rangeStart) {
            score += 6
          } else {
            const daysBefore = rangeStart.diff(eventStart, "days").days
            score -= Math.min(daysBefore * 1.5, 15) // Reduced penalty
          }
        }
      } else {
        // No date filter - use proximity-based scoring
        const eventDate = DateTime.fromJSDate(event.startAt)
        const now = DateTime.now()
        const daysDiff = eventDate.diff(now, "days").days
        if (daysDiff >= 0 && daysDiff <= 7) score += 3
        else if (daysDiff > 7 && daysDiff <= 30) score += 2
        else if (daysDiff > 30 && daysDiff <= 90) score += 1
        // Don't penalize far future events when no date filter is specified
      }

      return { ...event, score }
    })

    // Note: Date filtering is already applied in the WHERE clause, so all events here should be within range
    // This additional filter is just a safety net for edge cases
    let filteredEvents = rankedEvents
    if (dateFilter && dateFilter.gte && dateFilter.lte) {
      const rangeStart = DateTime.fromJSDate(dateFilter.gte).startOf("day")
      const rangeEnd = DateTime.fromJSDate(dateFilter.lte).endOf("day")
      
      // Only filter if we have a valid range
      if (rangeStart.isValid && rangeEnd.isValid) {
        const beforeFilter = filteredEvents.length
        filteredEvents = rankedEvents.filter((event) => {
          const eventDate = DateTime.fromJSDate(event.startAt).startOf("day")
          // Keep events within range or slightly outside (within 14 days for better UX)
          return eventDate >= rangeStart.minus({ days: 14 }) && eventDate <= rangeEnd.plus({ days: 14 })
        })
        if (beforeFilter !== filteredEvents.length) {
          console.log(`[v0] Post-filtered events by date range: ${beforeFilter} -> ${filteredEvents.length}`)
        }
      }
    }

    // Sort by score (highest first), then by start date
    filteredEvents.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.startAt.getTime() - b.startAt.getTime()
    })

    const latency = Date.now() - startTime

    console.log(
      JSON.stringify({
        phase: "2",
        intent: "SEARCH",
        entities: {
          keywords: query ? [query] : [],
          category: entities.type || entities.category || null,
          city: entities.city || null,
          venue: entities.venue || null,
          date: entities.date || null,
          time: entities.time || null,
        },
        input_mode: body.input_mode || "text",
        ui_lang: uiLang,
        search: {
          source: "internal",
          query_string: JSON.stringify(where),
          results_count: filteredEvents.length,
          latency_ms: latency,
        },
        error_code: errorCode,
      }),
    )

    return NextResponse.json({
      results: filteredEvents,
      count: filteredEvents.length,
      latency_ms: latency,
    })
  } catch (error) {
    console.error("[v0] Internal search error:", error)
    errorCode = "ERR_DB_CONNECT"

    console.log(
      JSON.stringify({
        phase: "2",
        intent: "SEARCH",
        entities: {},
        input_mode: "text",
        search: {
          source: "internal",
          query_string: "",
          results_count: 0,
          latency_ms: Date.now() - startTime,
        },
        error_code: errorCode,
      }),
    )

    return NextResponse.json(
      {
        error: "We couldn't reach Eventa right now. Try again.",
        error_code: errorCode,
        results: [],
        count: 0,
      },
      { status: 500 },
    )
  }
}

function mapToEventCategory(searchTerm: string): string | null {
  const categoryMap: Record<string, string> = {
    arts: "ARTS_CULTURE",
    culture: "ARTS_CULTURE",
    art: "ARTS_CULTURE",
    music: "MUSIC_NIGHTLIFE",
    nightlife: "MUSIC_NIGHTLIFE",
    concert: "MUSIC_NIGHTLIFE",
    jazz: "MUSIC_NIGHTLIFE",
    food: "FOOD_DRINK",
    drink: "FOOD_DRINK",
    restaurant: "FOOD_DRINK",
    family: "FAMILY_KIDS",
    kids: "FAMILY_KIDS",
    children: "FAMILY_KIDS",
    sports: "SPORTS_OUTDOORS",
    outdoors: "SPORTS_OUTDOORS",
    fitness: "SPORTS_OUTDOORS",
    community: "COMMUNITY_CAUSES",
    causes: "COMMUNITY_CAUSES",
    charity: "COMMUNITY_CAUSES",
    learning: "LEARNING_TALKS",
    talks: "LEARNING_TALKS",
    workshop: "LEARNING_TALKS",
    education: "LEARNING_TALKS",
    markets: "MARKETS_FAIRS",
    fairs: "MARKETS_FAIRS",
    market: "MARKETS_FAIRS",
    online: "ONLINE_VIRTUAL",
    virtual: "ONLINE_VIRTUAL",
  }

  const lowerTerm = searchTerm.toLowerCase()
  return categoryMap[lowerTerm] || null
}

function parseDatePhrase(phrase: string): { gte?: Date; lte?: Date } | undefined {
  const now = DateTime.now()
  const lowerPhrase = phrase.toLowerCase()

  if (lowerPhrase.includes("today")) {
    return {
      gte: now.startOf("day").toJSDate(),
      lte: now.endOf("day").toJSDate(),
    }
  }

  if (lowerPhrase.includes("tomorrow")) {
    const tomorrow = now.plus({ days: 1 })
    return {
      gte: tomorrow.startOf("day").toJSDate(),
      lte: tomorrow.endOf("day").toJSDate(),
    }
  }

  // Handle "next weekend" - weekend after the upcoming one
  if (lowerPhrase.includes("next weekend")) {
    const daysUntilSaturday = (6 - now.weekday + 7) % 7
    // Add 7 days to get the weekend after this one
    const saturday = now.plus({ days: (daysUntilSaturday || 7) + 7 })
    console.log(`[v0] Parsed "next weekend": ${saturday.toISODate()} to ${saturday.plus({ days: 1 }).toISODate()}`)
    return {
      gte: saturday.startOf("day").toJSDate(),
      lte: saturday.plus({ days: 1 }).endOf("day").toJSDate(),
    }
  }

  // Handle "this weekend" or just "weekend" - upcoming weekend
  if (lowerPhrase.includes("this weekend") || lowerPhrase.includes("weekend")) {
    const daysUntilSaturday = (6 - now.weekday + 7) % 7
    const saturday = now.plus({ days: daysUntilSaturday || 7 })
    console.log(`[v0] Parsed "this weekend": ${saturday.toISODate()} to ${saturday.plus({ days: 1 }).toISODate()}`)
    return {
      gte: saturday.startOf("day").toJSDate(),
      lte: saturday.plus({ days: 1 }).endOf("day").toJSDate(),
    }
  }

  if (lowerPhrase.includes("next month")) {
    const nextMonth = now.plus({ months: 1 })
    return {
      gte: nextMonth.startOf("month").toJSDate(),
      lte: nextMonth.endOf("month").toJSDate(),
    }
  }

  if (lowerPhrase.includes("this month")) {
    return {
      gte: now.startOf("month").toJSDate(),
      lte: now.endOf("month").toJSDate(),
    }
  }

  // Try to parse specific days
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  for (let i = 0; i < days.length; i++) {
    if (lowerPhrase.includes(days[i])) {
      const targetDay = i + 1 // luxon uses 1-7 for Mon-Sun
      let daysUntilTarget = (targetDay - now.weekday + 7) % 7
      if (daysUntilTarget === 0) daysUntilTarget = 7 // Next week if today
      const targetDate = now.plus({ days: daysUntilTarget })
      return {
        gte: targetDate.startOf("day").toJSDate(),
        lte: targetDate.endOf("day").toJSDate(),
      }
    }
  }

  // Try to parse month names (e.g., "April", "April 2026", "in April")
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ]
  
  for (let i = 0; i < months.length; i++) {
    if (lowerPhrase.includes(months[i])) {
      // Extract year if mentioned (e.g., "April 2026")
      const yearMatch = lowerPhrase.match(/\b(20\d{2})\b/)
      const monthNumber = i + 1
      
      let actualYear: number
      if (yearMatch) {
        // Year explicitly mentioned - use it
        actualYear = parseInt(yearMatch[1], 10)
      } else {
        // No year mentioned - determine based on current date
        // If the month is in the past this year, assume next year
        // If the month is current or future this year, use this year
        if (monthNumber < now.month) {
          actualYear = now.year + 1
        } else {
          actualYear = now.year
        }
      }
      
      const targetDate = DateTime.fromObject({ year: actualYear, month: monthNumber, day: 1 })
      if (!targetDate.isValid) {
        console.warn(`[v0] Invalid date created for month ${monthNumber}, year ${actualYear}`)
        return undefined
      }
      
      console.log(`[v0] Parsed month "${months[i]}" as ${targetDate.toISODate()} to ${targetDate.endOf("month").toISODate()}`)
      return {
        gte: targetDate.startOf("month").toJSDate(),
        lte: targetDate.endOf("month").toJSDate(),
      }
    }
  }

  // If we can't parse, return undefined (search without date filter)
  console.log("[v0] Could not parse date phrase:", phrase)
  return undefined
}

function getCategorySynonyms(category: string): string[] {
  const synonymMap: Record<string, string[]> = {
    music: ["Music", "Concert", "Gig", "Live Music", "Performance"],
    jazz: ["Jazz", "Music"],
    exhibition: ["Exhibition", "Expo", "Art Show", "Gallery"],
    expo: ["Exhibition", "Expo", "Trade Show"],
    networking: ["Networking", "Meetup", "Social"],
    meetup: ["Meetup", "Networking", "Social"],
    food: ["Food", "Festival", "Culinary"],
    festival: ["Festival", "Food", "Community", "Cultural"],
    workshop: ["Workshop", "Class", "Training", "Learning"],
    yoga: ["Yoga", "Wellness", "Fitness"],
    sports: ["Sports", "Fitness", "Athletic"],
    tech: ["Tech", "Technology", "IT", "Software"],
    business: ["Business", "Professional", "Corporate"],
    art: ["Art", "Creative", "Cultural"],
    community: ["Community", "Social", "Local"],
  }

  const lower = category.toLowerCase()
  return synonymMap[lower] || [category]
}
