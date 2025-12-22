import { type NextRequest, NextResponse } from "next/server"
import { PROVIDER_WHITELIST, type ProviderName } from "@/lib/external-search/provider-whitelist"
import { validateAndNormalizeExternalEvent } from "@/lib/external-search/schema-validator"
import { checkRateLimit, checkCircuitBreaker, recordFailure, recordSuccess } from "@/lib/external-search/rate-limiter"
import { searchWeb } from "@/lib/search/web-search"

const PROVIDER_TIMEOUT = 1500 // 1.5 seconds

async function fetchFromProvider(
  provider: ProviderName,
  params: { keywords: string[]; category?: string; city?: string; country?: string; date?: string },
): Promise<{
  provider: ProviderName
  results: any[]
  accepted: number
  dropped_schema: number
  dropped_safety: number
  latency_ms: number
  error: string | null
}> {
  const startTime = Date.now()

  // Check rate limit
  const rateLimitCheck = checkRateLimit(provider)
  if (!rateLimitCheck.allowed) {
    return {
      provider,
      results: [],
      accepted: 0,
      dropped_schema: 0,
      dropped_safety: 0,
      latency_ms: Date.now() - startTime,
      error: "RATE_LIMITED",
    }
  }

  // Check circuit breaker
  const circuitCheck = checkCircuitBreaker(provider)
  if (circuitCheck.open) {
    return {
      provider,
      results: [],
      accepted: 0,
      dropped_schema: 0,
      dropped_safety: 0,
      latency_ms: Date.now() - startTime,
      error: "CIRCUIT_OPEN",
    }
  }

  try {
    // Simulate provider-specific API calls with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT)

    const rawResults = await fetchProviderData(provider, params, controller.signal)
    clearTimeout(timeoutId)

    // Validate and normalize each result
    const validated = rawResults.map((raw) => validateAndNormalizeExternalEvent(raw, provider))

    // Transform validated events to include startAt for dual search compatibility
    const accepted = validated
      .filter((v) => v.event !== null)
      .map((v) => {
        const event = v.event!
        // Combine date and time into startAt ISO string
        let startAt: string
        if (event.time) {
          startAt = new Date(`${event.date}T${event.time}:00`).toISOString()
        } else {
          // If no time, use start of day
          startAt = new Date(`${event.date}T00:00:00`).toISOString()
        }
        
        // Try to extract a better date from title/description if structured date seems wrong
        // Look for date patterns like "April 2026", "16-19 April 2026", etc.
        const textToSearch = `${event.title} ${event.description || ""}`.toLowerCase()
        const monthNames = ["january", "february", "march", "april", "may", "june", 
                           "july", "august", "september", "october", "november", "december"]
        
        for (let i = 0; i < monthNames.length; i++) {
          if (textToSearch.includes(monthNames[i])) {
            // Found a month name - try to extract year
            const yearMatch = textToSearch.match(new RegExp(`${monthNames[i]}[^0-9]*?(20\\d{2})`, "i"))
            if (yearMatch) {
              const extractedYear = parseInt(yearMatch[1], 10)
              const monthNumber = i + 1
              const structuredDate = new Date(event.date)
              
              // If structured date year doesn't match extracted year, use extracted date
              if (structuredDate.getFullYear() !== extractedYear) {
                const extractedDate = new Date(extractedYear, monthNumber - 1, 1)
                startAt = extractedDate.toISOString()
                console.log(`[v0] Corrected date for "${event.title}": ${event.date} -> ${extractedDate.toISOString().split('T')[0]} (extracted from text)`)
              }
            }
            break
          }
        }
        
        return {
          ...event,
          startAt,
        }
      })
    const dropped_schema = validated.filter((v) => v.error?.code === "ERR_EXT_SCHEMA_REQUIRED").length
    const dropped_safety = validated.filter((v) => v.error?.code === "ERR_EXT_SAFETY_FILTER").length

    // Log rejected items
    validated.forEach((v) => {
      if (v.error) {
        console.log(`[v0] Rejected external event from ${provider}:`, v.error)
      }
    })

    recordSuccess(provider)

    return {
      provider,
      results: accepted,
      accepted: accepted.length,
      dropped_schema,
      dropped_safety,
      latency_ms: Date.now() - startTime,
      error: null,
    }
  } catch (error: any) {
    recordFailure(provider)

    const errorCode = error.name === "AbortError" ? "ERR_EXT_TIMEOUT" : "ERR_EXT_CONNECT"

    return {
      provider,
      results: [],
      accepted: 0,
      dropped_schema: 0,
      dropped_safety: 0,
      latency_ms: Date.now() - startTime,
      error: errorCode,
    }
  }
}

async function fetchProviderData(provider: ProviderName, params: any, signal: AbortSignal): Promise<any[]> {
  // Handle web search providers using Google Custom Search API
  if (provider === "stub_web" || provider === "google_events") {
    // Build search query from keywords, category, city
    const queryParts: string[] = []
    
    if (params.keywords && params.keywords.length > 0) {
      queryParts.push(...params.keywords)
    }
    
    if (params.category) {
      queryParts.push(params.category)
    }
    
    if (params.city) {
      queryParts.push(params.city)
    }
    
    // Add country to query to improve disambiguation (e.g., "Ithaki Greece" vs "Ithaca USA")
    if (params.country) {
      queryParts.push(params.country)
    }
    
    const searchQuery = queryParts.join(" ")
    
    if (!searchQuery.trim()) {
      return []
    }

    try {
      // Use the actual web search function
      const webResults = await searchWeb({
        query: searchQuery,
        limit: 10,
        signal,
      })

      // Transform web search results to external event format
      return webResults.map((result) => {
        // Try to extract city and venue from snippet or title
        const snippet = result.snippet || ""
        const cityMatch = params.city || snippet.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/)?.[0]
        const venueMatch = snippet.match(/(?:at|@|venue:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)?.[1]

        return {
          title: result.title,
          description: result.snippet || null,
          startAt: result.startAt,
          city: cityMatch || null,
          venue: venueMatch || null,
          sourceUrl: result.url || null,
          imageUrl: result.imageUrl || null, // Include imageUrl from web search
        }
      })
    } catch (error) {
      console.error(`[v0] Web search error for ${provider}:`, error)
      return []
    }
  }

  // For other providers (eventbrite, meetup, facebook_events), return empty for now
  // These would need actual API integrations
  return []
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { keywords = [], category, city, country, date, date_iso, uiLang = "en" } = body

    console.log(`[v0] External search request - uiLang: ${uiLang}`, { keywords, category, city, country, date, date_iso })

    // Query all whitelisted providers in parallel
    const providerResults = await Promise.all(
      PROVIDER_WHITELIST.map((provider) => fetchFromProvider(provider, { keywords, category, city, country, date })),
    )

    // Merge results in whitelist order
    const allResults: any[] = []
    let totalAccepted = 0
    let totalDroppedSchema = 0
    let totalDroppedSafety = 0

    providerResults.forEach((pr) => {
      allResults.push(...pr.results)
      totalAccepted += pr.accepted
      totalDroppedSchema += pr.dropped_schema
      totalDroppedSafety += pr.dropped_safety
    })

    // Filter results by date range if date_iso or date is provided
    let filteredResults = allResults
    if (date_iso || date) {
      try {
        const { DateTime } = await import("luxon")
        let startDate: DateTime
        let endDate: DateTime
        
        if (date_iso) {
          // Specific date ISO format
          startDate = DateTime.fromISO(date_iso).startOf("day")
          
          // Parse duration from keywords if available (e.g., "one week")
          const queryText = keywords.join(" ").toLowerCase()
          let durationDays = 7 // Default to 1 week
          if (queryText.includes("one week") || queryText.includes("1 week")) {
            durationDays = 7
          } else {
            const daysMatch = queryText.match(/(\d+)\s+days?/i)
            if (daysMatch) durationDays = parseInt(daysMatch[1], 10)
            const weeksMatch = queryText.match(/(\d+)\s+weeks?/i)
            if (weeksMatch) durationDays = parseInt(weeksMatch[1], 10) * 7
          }
          
          endDate = startDate.plus({ days: durationDays }).endOf("day")
        } else if (date) {
          // Parse natural language date (e.g., "next weekend")
          const lowerDate = date.toLowerCase()
          const now = DateTime.now()
          
          if (lowerDate.includes("next weekend")) {
            const daysUntilSaturday = (6 - now.weekday + 7) % 7
            startDate = now.plus({ days: (daysUntilSaturday || 7) + 7 }).startOf("day")
            endDate = startDate.plus({ days: 1 }).endOf("day")
          } else if (lowerDate.includes("this weekend") || lowerDate.includes("weekend")) {
            const daysUntilSaturday = (6 - now.weekday + 7) % 7
            startDate = now.plus({ days: daysUntilSaturday || 7 }).startOf("day")
            endDate = startDate.plus({ days: 1 }).endOf("day")
          } else if (lowerDate.includes("tomorrow")) {
            startDate = now.plus({ days: 1 }).startOf("day")
            endDate = startDate.endOf("day")
          } else if (lowerDate.includes("today")) {
            startDate = now.startOf("day")
            endDate = now.endOf("day")
          } else {
            // Unknown date format, skip filtering
            console.log(`[v0] Unknown date format for external search filtering: "${date}"`)
            startDate = null as any
            endDate = null as any
          }
        } else {
          startDate = null as any
          endDate = null as any
        }
        
        if (startDate && endDate && startDate.isValid && endDate.isValid) {
          filteredResults = allResults.filter((result) => {
            if (!result.startAt) return false
            const eventDate = DateTime.fromISO(result.startAt)
            return eventDate >= startDate && eventDate <= endDate
          })
          
          console.log(`[v0] Filtered external results by date: ${allResults.length} -> ${filteredResults.length} (range: ${startDate.toISODate()} to ${endDate.toISODate()})`, {
            date_iso,
            date,
            dateRange: `${startDate.toISODate()} to ${endDate.toISODate()}`,
          })
        }
      } catch (error) {
        console.warn(`[v0] Failed to filter by date (date_iso: ${date_iso}, date: ${date}):`, error)
      }
    } else {
      console.log(`[v0] No date filter for external search (date_iso: ${date_iso}, date: ${date})`)
    }

    // LOCATION DISAMBIGUATION: Filter results by city with country-aware disambiguation
    if (city) {
      const cityLower = city.toLowerCase().trim()
      const countryLower = country ? country.toLowerCase().trim() : null
      const beforeCityFilter = filteredResults.length
      
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
      
      filteredResults = filteredResults.filter((result) => {
        const resultCity = (result.city || "").toLowerCase().trim()
        const resultLocation = (result.location?.city || "").toLowerCase().trim()
        const resultAddress = (result.address || "").toLowerCase()
        const resultTitle = (result.title || "").toLowerCase()
        const resultDescription = (result.description || "").toLowerCase()
        const resultCountry = (result.country || "").toLowerCase().trim()
        
        // Check if city appears as a standalone word (not part of a compound name)
        const cityRegex = new RegExp(`\\b${cityLower}\\b`, "i")
        
        // Must match city in city field or location
        const matchesCity = cityRegex.test(resultCity) || cityRegex.test(resultLocation)
        
        if (!matchesCity) {
          // Also check title/description for city mentions, but be more lenient
          return cityRegex.test(resultTitle) || cityRegex.test(resultDescription)
        }
        
        // If city matches, apply disambiguation logic
        if (isAmbiguous) {
          // If country was specified in query, use it to filter
          if (countryLower) {
            // Check if result mentions the expected country
            const resultText = `${resultCity} ${resultLocation} ${resultAddress} ${resultTitle} ${resultDescription} ${resultCountry}`.toLowerCase()
            const countryMatches = expectedCountries.some((expectedCountry) => {
              const expectedLower = expectedCountry.toLowerCase()
              // Check if result text contains the expected country
              return resultText.includes(expectedLower) || 
                     (expectedLower.includes("usa") && /\b(usa|united states|us|america)\b/i.test(resultText)) ||
                     (expectedLower.includes("uk") && /\b(uk|united kingdom|britain|british)\b/i.test(resultText))
            })
            
            // If we're searching for a specific country, only include results that match
            if (countryLower && !countryMatches) {
              // Check if the specified country matches any expected country
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
            const hasUSState = /\b(maryland|md|california|ca|texas|tx|new york|ny|florida|fl|georgia|ga|tennessee|tn|virginia|va|new mexico|nm|massachusetts|ma|ontario)\b/i.test(
              resultCity + " " + resultLocation + " " + resultAddress
            )
            const hasUSCountry = /\b(usa|united states|us|america)\b/i.test(
              resultCity + " " + resultLocation + " " + resultAddress + " " + resultCountry
            )
            
            // For ambiguous cities, prefer international matches unless US is explicitly mentioned
            if (hasUSState && !hasUSCountry) {
              // Likely a US city with same name, exclude it for ambiguous international cities
              return false
            }
          }
        }
        
        return true
      })
      
      console.log(`[v0] Filtered external results by city "${city}"${country ? `, country "${country}"` : ""}: ${beforeCityFilter} -> ${filteredResults.length}`)
    }

    const totalLatency = Date.now() - startTime

    return NextResponse.json({
      results: filteredResults,
      count: filteredResults.length,
      latency_ms: totalLatency,
      providers: providerResults,
      stats: {
        total_accepted: totalAccepted,
        dropped_schema: totalDroppedSchema,
        dropped_safety: totalDroppedSafety,
        filtered_by_date: date_iso ? allResults.length - filteredResults.length : 0,
        filtered_by_city: city ? allResults.length - filteredResults.length : 0,
      },
    })
  } catch (error) {
    const latency = Date.now() - startTime
    console.error("[v0] External search error:", error)

    return NextResponse.json(
      {
        error: "ERR_EXT_CONNECT",
        message: "External search providers unavailable",
        results: [],
        count: 0,
        latency_ms: latency,
      },
      { status: 503 },
    )
  }
}
