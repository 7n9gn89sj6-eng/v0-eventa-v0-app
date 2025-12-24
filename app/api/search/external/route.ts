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

    // CRITICAL: LOCATION FILTERING - Filter results by city with strict country-aware disambiguation
    // This is a first line of defense - the dual route location guard is the second line
    if (city) {
      const cityLower = city.toLowerCase().trim()
      const countryLower = country ? country.toLowerCase().trim() : null
      const beforeCityFilter = filteredResults.length
      
      // US states for exclusion when searching from non-US countries
      const usStates = [
        "texas", "tx", "california", "ca", "florida", "fl", "new york", "ny", "pennsylvania", "pa",
        "illinois", "il", "ohio", "oh", "georgia", "ga", "north carolina", "nc", "michigan", "mi",
        "new jersey", "nj", "virginia", "va", "washington", "wa", "arizona", "az", "massachusetts", "ma",
        "tennessee", "tn", "indiana", "in", "missouri", "mo", "maryland", "md", "wisconsin", "wi",
        "colorado", "co", "minnesota", "mn", "south carolina", "sc", "alabama", "al", "louisiana", "la",
        "kentucky", "ky", "oregon", "or", "oklahoma", "ok", "connecticut", "ct", "utah", "ut",
        "iowa", "ia", "nevada", "nv", "arkansas", "ar", "mississippi", "ms", "kansas", "ks",
        "new mexico", "nm", "nebraska", "ne", "west virginia", "wv", "idaho", "id", "hawaii", "hi"
      ]
      
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
        "austin": ["texas", "usa"], // Austin is in Texas, USA
        "fort worth": ["texas", "usa"],
        "seneca": ["new york", "usa"], // Seneca Lakes is in NY
      }
      
      const isAmbiguous = ambiguousCities[cityLower] !== undefined
      const expectedCountries = isAmbiguous ? ambiguousCities[cityLower] : []
      
      filteredResults = filteredResults.filter((result) => {
        const resultCity = (result.city || "").toLowerCase().trim()
        const resultLocation = (result.location?.city || "").toLowerCase().trim()
        const resultAddress = (result.address || "").toLowerCase()
        const resultTitle = (result.title || "").toLowerCase()
        const resultDescription = (result.description || "").toLowerCase()
        const resultCountry = (result.country || result.location?.country || "").toLowerCase().trim()
        const resultFullText = `${resultCity} ${resultLocation} ${resultAddress} ${resultTitle} ${resultDescription} ${resultCountry}`.toLowerCase()
        
        // CRITICAL FIRST PASS: If searching from Australia, exclude ANY result mentioning US cities/states
        // This is a hard filter - no exceptions (except online events)
        if (countryLower && countryLower.includes("australia")) {
          // Check for known US cities
          const knownUSCities = [
            "fort worth", "austin", "seneca", "dallas", "houston", "boston", "kansas city",
            "phoenix", "chicago", "los angeles", "new york", "san francisco", "seattle"
          ]
          const mentionsUSCity = knownUSCities.some(usCity => {
            if (usCity === cityLower) return false // Don't exclude if it's the target city
            const usCityRegex = new RegExp(`\\b${usCity}\\b`, "i")
            return usCityRegex.test(resultFullText)
          })
          
          if (mentionsUSCity) {
            return false // Hard exclude - US city detected
          }
          
          // Check for US state mentions
          const mentionsUSState = usStates.some(state => {
            const stateRegex = new RegExp(`\\b${state}\\b`, "i")
            return stateRegex.test(resultFullText)
          })
          if (mentionsUSState) {
            return false // Hard exclude - US state detected
          }
          
          // Check for US country indicators
          const hasUSIndicators = /\b(usa|united states|us|america|u\.s\.|u\.s\.a\.)\b/i.test(resultFullText)
          const hasAustraliaIndicators = /\b(australia|au|australian)\b/i.test(resultFullText)
          if (hasUSIndicators && !hasAustraliaIndicators) {
            return false // Has US but not Australia indicators - exclude
          }
        }
        
        // Check if city appears as a standalone word (not part of a compound name)
        const cityRegex = new RegExp(`\\b${cityLower}\\b`, "i")
        
        // Must match city in city field or location (strict check)
        const matchesCity = cityRegex.test(resultCity) || cityRegex.test(resultLocation) || cityRegex.test(resultAddress)
        
        if (!matchesCity) {
          // Only check title/description if city field is empty (fallback for poorly structured data)
          // But still apply negative filtering
          if (!resultCity && !resultLocation) {
            // Check for other major cities that would indicate wrong location
            const otherMajorCities = ["fort worth", "austin", "seneca", "dallas", "houston", "boston", "kansas city"]
            const mentionsOtherCity = otherMajorCities.some(otherCity => {
              if (otherCity === cityLower) return false // Don't exclude if it's the target city
              const otherCityRegex = new RegExp(`\\b${otherCity}\\b`, "i")
              return otherCityRegex.test(resultFullText)
            })
            if (mentionsOtherCity) {
              return false
            }
            // Only allow if city appears in title/description
            return cityRegex.test(resultTitle) || cityRegex.test(resultDescription)
          }
          return false
        }
        
        // CRITICAL COUNTRY CHECK: If country is specified, enforce strict matching
        if (countryLower) {
          // Check if result mentions the expected country
          const countryMatches = 
            (countryLower.includes("australia") && (resultFullText.includes("australia") || resultCountry.includes("australia"))) ||
            (countryLower.includes("usa") && /\b(usa|united states|us|america)\b/i.test(resultFullText)) ||
            (countryLower.includes("united kingdom") && /\b(uk|united kingdom|britain|british)\b/i.test(resultFullText)) ||
            resultCountry.includes(countryLower) ||
            countryLower.includes(resultCountry)
          
          // If country doesn't match, exclude (unless it's explicitly an online event)
          const isOnline = resultFullText.includes("online") || resultFullText.includes("virtual")
          if (!countryMatches && !isOnline) {
            // Extra check: if searching from Australia and result has US indicators, exclude
            if (countryLower.includes("australia")) {
              const hasUSIndicators = /\b(usa|united states|us|america|texas|florida|california|new york)\b/i.test(resultFullText)
              if (hasUSIndicators) {
                return false
              }
            }
            return false // Country doesn't match, exclude
          }
        } else if (isAmbiguous) {
          // No country specified but city is ambiguous - exclude US state matches for international cities
          const hasUSState = usStates.some(state => {
            const stateRegex = new RegExp(`\\b${state}\\b`, "i")
            return stateRegex.test(resultFullText)
          })
          const hasUSCountry = /\b(usa|united states|us|america)\b/i.test(resultFullText)
          
          // For ambiguous international cities, prefer international matches
          if (hasUSState && !hasUSCountry) {
            // Likely a US city with same name, exclude it for ambiguous international cities
            return false
          }
        }
        
        // FINAL CHECK: Exclude if result mentions other major US cities (defense in depth)
        const otherUSCities = ["fort worth", "austin", "seneca", "dallas", "houston", "boston", "kansas city", "phoenix", "chicago"]
        if (cityLower !== "austin" && cityLower !== "fort worth" && cityLower !== "seneca") {
          const mentionsOtherUSCity = otherUSCities.some(otherCity => {
            const otherCityRegex = new RegExp(`\\b${otherCity}\\b`, "i")
            return otherCityRegex.test(resultFullText)
          })
          if (mentionsOtherUSCity && countryLower && countryLower.includes("australia")) {
            return false // Exclude US cities when searching from Australia
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

