import { type NextRequest, NextResponse } from "next/server"

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

function normalizeForDedup(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function deduplicateResults(internal: any[], external: any[]) {
  const internalNormalized = internal.map((event) => ({
    ...event,
    source: "internal",
    normalizedTitle: normalizeForDedup(event.title),
  }))

  let droppedDedupe = 0

  const externalFiltered = external.filter((extEvent) => {
    const extTitle = normalizeForDedup(extEvent.title)
    const extDate = extEvent.date || new Date(extEvent.startAt).toISOString().split("T")[0]
    const extVenue = normalizeForDedup(extEvent.venue || extEvent.city || "")

    // Check if this external event matches any internal event
    const isDuplicate = internalNormalized.some((intEvent) => {
      const intDate = new Date(intEvent.startAt).toISOString().split("T")[0]
      const intVenue = normalizeForDedup(intEvent.venueName || intEvent.city || "")

      // Must match date
      if (extDate !== intDate) return false

      // Fuzzy match on title (Levenshtein ≤ 2)
      const titleDistance = levenshteinDistance(intEvent.normalizedTitle, extTitle)
      if (titleDistance <= 2) return true

      // Or exact venue match with similar title
      if (intVenue === extVenue && titleDistance <= 5) return true

      return false
    })

    if (isDuplicate) droppedDedupe++
    return !isDuplicate
  })

  const externalNormalized = externalFiltered.map((event) => ({
    ...event,
    source: "external",
  }))

  return {
    internal: internalNormalized,
    external: externalNormalized,
    droppedDedupe,
  }
}

/**
 * Hard location guard for trip queries.
 * When a city is confidently extracted and trip intent is present,
 * filter out events from different cities/countries.
 * 
 * This ensures trip queries NEVER show irrelevant events from other locations.
 * 
 * @param results - Array of events (internal or external)
 * @param targetCity - The city name extracted from the query
 * @param targetCountry - Optional country name for disambiguation
 * @returns Filtered array containing only events in the target city
 */
function applyLocationGuard(results: any[], targetCity: string, targetCountry?: string): any[] {
  if (!targetCity || targetCity.trim().length === 0) {
    return results // No city specified, return all results
  }

  const cityLower = targetCity.toLowerCase().trim()
  
  // City name variations map (same as in internal search)
  const cityVariations: Record<string, string[]> = {
    "berlin": ["berlin", "berlín"],
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
    "new york": ["nyc", "new york city", "manhattan"],
    "los angeles": ["la", "los angeles"],
    "san francisco": ["sf", "san francisco"],
  }
  
  // Get all variations for the target city
  const variations = cityVariations[cityLower] || []
  const allCityNames = [cityLower, ...variations]
  
  // Country variations for matching
  const countryVariations: Record<string, string[]> = {
    "united states": ["usa", "us", "united states", "america"],
    "greece": ["greece", "greek"],
    "italy": ["italy", "italian"],
    "spain": ["spain", "spanish"],
    "france": ["france", "french"],
    "united kingdom": ["uk", "united kingdom", "britain", "british"],
    "germany": ["germany", "german", "deutschland"],
  }
  
  // Normalize target country if provided
  let targetCountryLower: string | null = null
  if (targetCountry) {
    const countryLower = targetCountry.toLowerCase().trim()
    // Find matching country variation
    for (const [standard, variations] of Object.entries(countryVariations)) {
      if (variations.some(v => countryLower.includes(v) || v.includes(countryLower))) {
        targetCountryLower = standard
        break
      }
    }
    if (!targetCountryLower) {
      targetCountryLower = countryLower
    }
  }

  // List of major city names to check for false positives (exclude events that explicitly mention these)
  // Expanded to include more US cities that commonly appear in web search results
  const otherMajorCities = [
    // US cities
    "new york", "nyc", "los angeles", "la", "chicago", "houston", "phoenix", "philadelphia",
    "san antonio", "san diego", "dallas", "san jose", "austin", "jacksonville", "san francisco", "sf",
    "boston", "kansas city", "seattle", "denver", "washington", "detroit", "minneapolis", "miami",
    "atlanta", "portland", "orlando", "las vegas", "nashville", "cleveland", "tampa", "sacramento",
    "fort worth", "fort wayne", "seneca", "seneca lakes", "indianapolis", "columbus", "charlotte",
    "el paso", "memphis", "milwaukee", "oklahoma city", "tucson", "fresno", "mesa", "virginia beach",
    "oakland", "omaha", "raleigh", "long beach", "miami beach", "colorado springs", "raleigh",
    // International cities
    "london", "paris", "madrid", "barcelona", "amsterdam", "berlin", "milan", "vienna", "prague",
    "lisbon", "stockholm", "copenhagen", "dublin", "edinburgh", "zurich", "brussels", "athens",
    "tokyo", "sydney", "toronto", "vancouver", "montreal", "mexico city"
  ]
  
  // US states to check for (helps catch "Austin, Texas" type matches)
  const usStates = [
    "texas", "california", "florida", "new york", "pennsylvania", "illinois", "ohio", "georgia",
    "north carolina", "michigan", "new jersey", "virginia", "washington", "arizona", "massachusetts",
    "tennessee", "indiana", "missouri", "maryland", "wisconsin", "colorado", "minnesota", "south carolina",
    "alabama", "louisiana", "kentucky", "oregon", "oklahoma", "connecticut", "utah", "iowa",
    "nevada", "arkansas", "mississippi", "kansas", "new mexico", "nebraska", "west virginia",
    "idaho", "hawaii", "new hampshire", "maine", "montana", "rhode island", "delaware",
    "south dakota", "north dakota", "alaska", "vermont", "wyoming"
  ]
  
  const beforeFilter = results.length
  const filtered = results.filter((event) => {
    // Extract city from event (handle both internal and external formats)
    const eventCity = (event.city || event.location?.city || "").toLowerCase().trim()
    const eventCountry = (event.country || event.location?.country || "").toLowerCase().trim()
    
    // Extract city from address if city field is empty
    const eventAddress = (event.address || event.location?.address || event.venueName || "").toLowerCase().trim()
    const eventTitle = (event.title || "").toLowerCase()
    const eventDescription = (event.description || "").toLowerCase()
    const fullText = `${eventTitle} ${eventDescription} ${eventAddress}`.toLowerCase()
    
    // Check if event is explicitly marked as online/global
    const isOnline = event.isOnline === true || 
                     eventAddress.includes("online") || 
                     eventAddress.includes("virtual") ||
                     eventTitle.includes("online") ||
                     eventTitle.includes("virtual")
    
    // Allow online/global events through
    if (isOnline) {
      return true
    }
    
    // STRICT CHECK: City must match in the city field OR address field (not just title mentions)
    // This prevents false positives where "Rome" appears in a title about Boston events
    const cityMatchesStrict = allCityNames.some(cityVar => {
      // Primary: city field must match
      if (eventCity && (eventCity === cityVar || eventCity.includes(cityVar) || cityVar.includes(eventCity))) {
        return true
      }
      // Secondary: address field must match (venue location is more reliable than title mentions)
      if (eventAddress && (eventAddress.includes(cityVar) || eventAddress.includes(` ${cityVar},`) || eventAddress.includes(` ${cityVar} `))) {
        return true
      }
      return false
    })
    
    // If strict check fails, do a secondary check on title/description but with negative filtering
    let cityMatches = cityMatchesStrict
    if (!cityMatches) {
      // Only check title/description if city field is empty (fallback for poorly structured data)
      if (!eventCity && allCityNames.some(cityVar => fullText.includes(cityVar))) {
        // But first check for other major cities that would indicate wrong location
        const mentionsOtherCity = otherMajorCities.some(otherCity => {
          // Don't exclude if the other city is actually the target city (handles variations)
          if (allCityNames.includes(otherCity)) return false
          // Check if another major city is explicitly mentioned (with word boundaries)
          const otherCityRegex = new RegExp(`\\b${otherCity}\\b`, "i")
          return otherCityRegex.test(fullText)
        })
        
        // Only allow if no other major city is mentioned
        cityMatches = !mentionsOtherCity
      }
    }
    
    if (!cityMatches) {
      return false // City doesn't match, exclude
    }
    
    // NEGATIVE CHECK: Exclude if another major city is explicitly mentioned (stronger signal than target city)
    const mentionsOtherCity = otherMajorCities.some(otherCity => {
      // Skip if this other city is actually a variation of our target city
      if (allCityNames.includes(otherCity)) return false
      // Check if another major city appears with word boundaries (more reliable than substring)
      const otherCityRegex = new RegExp(`\\b${otherCity}\\b`, "i")
      // Check in city field, address, or title/description with location context
      return otherCityRegex.test(eventCity) || 
             otherCityRegex.test(eventAddress) ||
             (otherCityRegex.test(fullText) && /(in|at|near|from|to|at)\s+/.test(fullText))
    })
    
    // CRITICAL: If target country is specified and doesn't match, exclude (e.g., searching Melbourne, Australia but result is Melbourne, FL)
    if (targetCountryLower && eventCountry) {
      // Check if event country matches target country
      const countryMatches = countryVariations[targetCountryLower]?.some(countryVar => {
        return eventCountry.includes(countryVar) || countryVar.includes(eventCountry)
      }) || eventCountry.includes(targetCountryLower) || targetCountryLower.includes(eventCountry)
      
      // If countries don't match, and it's not online, exclude
      if (!countryMatches && !isOnline) {
        // Extra check: if target is Australia and event mentions US state, definitely exclude
        if (targetCountryLower.includes("australia") && usStates.some(state => {
          const stateRegex = new RegExp(`\\b${state}\\b`, "i")
          return stateRegex.test(fullText)
        })) {
          return false
        }
        // If country doesn't match, exclude
        return false
      }
    }
    
    // If target country is Australia and result mentions US state, exclude it
    if (targetCountryLower && targetCountryLower.includes("australia")) {
      const mentionsUSState = usStates.some(state => {
        const stateRegex = new RegExp(`\\b${state}\\b`, "i")
        return stateRegex.test(fullText)
      })
      if (mentionsUSState) {
        return false // Exclude US results when searching from Australia
      }
    }
    
    if (mentionsOtherCity) {
      return false // Another city is mentioned, exclude
    }
    
    // CRITICAL COUNTRY CHECK: If target country is specified, ensure it matches
    // This is especially important for disambiguation (Melbourne, Australia vs Melbourne, FL)
    if (targetCountryLower) {
      // If event has country info, check if it matches
      if (eventCountry) {
        const countryMatches = countryVariations[targetCountryLower]?.some(countryVar => {
          return eventCountry.includes(countryVar) || countryVar.includes(eventCountry)
        }) || eventCountry.includes(targetCountryLower) || targetCountryLower.includes(eventCountry)
        
        if (!countryMatches && !isOnline) {
          return false // Country doesn't match, exclude (unless online event)
        }
      } else {
        // No country in event data, but we have target country
        // If target is Australia and event mentions US state, exclude it
        if (targetCountryLower.includes("australia")) {
          const mentionsUSState = usStates.some(state => {
            const stateRegex = new RegExp(`\\b${state}\\b`, "i")
            return stateRegex.test(fullText)
          })
          if (mentionsUSState) {
            return false // Exclude US results when searching from Australia
          }
        }
      }
    }
    
    return true // City (and optionally country) matches
  })
  
  if (beforeFilter !== filtered.length) {
    console.log(`[v0] Location guard applied: ${beforeFilter} -> ${filtered.length} events for city: ${targetCity}${targetCountry ? `, ${targetCountry}` : ""}`)
  }
  
  return filtered
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const body = await request.json()
  const { entities, query, input_mode = "text", uiLang = "en", isTripIntent, duration, interests } = body

  console.log(`[v0] Dual search request - uiLang: ${uiLang}`, { 
    entities, 
    query, 
    isTripIntent, 
    duration, 
    interests,
    city: entities?.city,
    country: entities?.country,
  })

  // Run both searches in parallel
  const [internalResponse, externalResponse] = await Promise.allSettled([
    fetch(`${request.nextUrl.origin}/api/search/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entities, query, input_mode, uiLang, isTripIntent, duration, interests }),
    }).then((res) => res.json()),
    fetch(`${request.nextUrl.origin}/api/search/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: query ? [query] : [],
        category: entities.type || entities.category,
        city: entities.city,
        country: entities.country,
        date: entities.date,
        date_iso: entities.date_iso,
        uiLang,
      }),
    }).then((res) => res.json()),
  ])

  // Extract results and errors
  const internalData = internalResponse.status === "fulfilled" ? internalResponse.value : null
  const externalData = externalResponse.status === "fulfilled" ? externalResponse.value : null

  const internalError = internalData?.error_code || (internalResponse.status === "rejected" ? "ERR_DB_CONNECT" : null)
  const externalError = externalData?.error || (externalResponse.status === "rejected" ? "ERR_EXT_CONNECT" : null)

  const internalResults = internalData?.results || []
  let externalResults = externalData?.results || []

  // TIME RELEVANCE: Filter stale web results when time intent is present
  const hasTimeIntent = entities.date || entities.date_iso || entities.time || 
    (query && /(this|next|tonight|today|tomorrow|weekend|over|during)\s+(weekend|week|month|christmas|xmas|easter|holiday)/i.test(query))
  
  if (hasTimeIntent && externalResults.length > 0) {
    const { DateTime } = await import("luxon")
    const now = DateTime.now()
    
    // Determine the target date range from entities
    let targetStart: DateTime | null = null
    let targetEnd: DateTime | null = null
    
    if (entities.date_iso) {
      targetStart = DateTime.fromISO(entities.date_iso).startOf("day")
      // Default to 7 days duration if not specified
      targetEnd = targetStart.plus({ days: 7 }).endOf("day")
    } else if (entities.date) {
      const dateLower = entities.date.toLowerCase()
      
      if (dateLower.includes("tonight") || dateLower.includes("today")) {
        targetStart = now.startOf("day")
        targetEnd = now.endOf("day")
      } else if (dateLower.includes("tomorrow")) {
        targetStart = now.plus({ days: 1 }).startOf("day")
        targetEnd = targetStart.endOf("day")
      } else if (dateLower.includes("this weekend") || dateLower.includes("weekend")) {
        const daysUntilSaturday = (6 - now.weekday + 7) % 7
        targetStart = now.plus({ days: daysUntilSaturday || 7 }).startOf("day")
        targetEnd = targetStart.plus({ days: 1 }).endOf("day")
      } else if (dateLower.includes("next weekend")) {
        const daysUntilSaturday = (6 - now.weekday + 7) % 7
        targetStart = now.plus({ days: (daysUntilSaturday || 7) + 7 }).startOf("day")
        targetEnd = targetStart.plus({ days: 1 }).endOf("day")
      }
    }
    
    // Filter external results by date relevance
    if (targetStart && targetEnd) {
      const beforeFilter = externalResults.length
      externalResults = externalResults.filter((result) => {
        if (!result.startAt) {
          // If no date, mark as informational (not current event)
          return true // Keep but will be labeled as informational
        }
        
        try {
          const eventDate = DateTime.fromISO(result.startAt)
          // Keep results within 30 days of target range (more lenient for web results)
          const daysDiff = Math.abs(eventDate.diff(targetStart, "days").days)
          return daysDiff <= 30
        } catch {
          // Invalid date, keep but mark as informational
          return true
        }
      })
      
      if (beforeFilter !== externalResults.length) {
        console.log(`[v0] Filtered stale web results by time intent: ${beforeFilter} -> ${externalResults.length}`)
      }
    }
  }

  const deduped = deduplicateResults(internalResults, externalResults)

  // PART 1: HARD LOCATION GUARD for city-specific queries
  // When a city is confidently extracted, apply strict location filtering
  // to prevent irrelevant events from other cities
  // Apply to ALL queries with city (not just trip intent) to ensure quality results
  let finalInternal = deduped.internal
  let finalExternal = deduped.external
  
  if (entities?.city && entities.city.trim().length > 0) {
    const targetCity = entities.city.trim()
    const targetCountry = entities.country?.trim()
    
    console.log(`[v0] 🔒 Applying location guard for query with city: city="${targetCity}"${targetCountry ? `, country="${targetCountry}"` : ""}`)
    
    // Apply location guard to both internal and external results
    const beforeInternal = finalInternal.length
    const beforeExternal = finalExternal.length
    
    finalInternal = applyLocationGuard(finalInternal, targetCity, targetCountry)
    finalExternal = applyLocationGuard(finalExternal, targetCity, targetCountry)
    
    const droppedInternal = beforeInternal - finalInternal.length
    const droppedExternal = beforeExternal - finalExternal.length
    
    if (droppedInternal > 0 || droppedExternal > 0) {
      console.log(`[v0] ✅ Location guard filtered out ${droppedInternal} internal + ${droppedExternal} external events from different cities`)
    } else {
      console.log(`[v0] ⚠️ Location guard applied but no events were filtered - this might indicate an issue`)
    }
    
    // CRITICAL: Do NOT widen geography if insufficient results
    // It's better to return fewer relevant results than to show irrelevant ones
  } else {
    console.log(`[v0] ⚠️ No city in entities - location guard NOT applied. Entities:`, entities)
  }

  // EVENTS-FIRST: Always prioritize Eventa events
  // Internal results come first, then external (web) results
  // External results are clearly marked as "Related information from the web"
  const mergedResults = [
    ...finalInternal.map((r) => ({ ...r, source: "internal" as const })),
    ...finalExternal.map((r) => ({ ...r, source: "external" as const, isWebResult: true })),
  ]

  const totalLatency = Date.now() - startTime

  console.log(
    JSON.stringify({
      phase: "5",
      intent: "SEARCH",
      entities: {
        keywords: query ? [query] : [],
        category: entities.type || entities.category || null,
        city: entities.city || null,
        venue: entities.venue || null,
        date: entities.date || null,
        time: entities.time || null,
      },
      input_mode,
      ui_lang: uiLang,
      search: {
        internal: {
          results: internalResults.length,
          latency_ms: internalData?.latency_ms || 0,
          error: internalError,
        },
        external: {
          providers: externalData?.providers || [],
          merged: {
            total_in: externalResults.length,
            accepted: externalData?.stats?.total_accepted || 0,
            deduped: deduped.droppedDedupe,
          },
        },
      },
      create: { enabled: true, published: false },
      error_code: internalError && externalError ? "ERR_BOTH_DOWN" : internalError || externalError || null,
    }),
  )

  let message = null
  const hasRateLimitIssues = externalData?.providers?.some((p: any) => p.error === "RATE_LIMITED")
  const hasCircuitOpen = externalData?.providers?.some((p: any) => p.error === "CIRCUIT_OPEN")

  if (internalError && externalError) {
    message = "We couldn't fetch results right now. Please try again."
  } else if (internalError) {
    message = "We couldn't reach Eventa right now. Showing web results if available."
  } else if (externalError || hasRateLimitIssues || hasCircuitOpen) {
    message = "Some web sources aren't responding. Showing what we have."
  }

  return NextResponse.json({
    results: mergedResults,
    count: mergedResults.length,
    internal_count: finalInternal.length,
    external_count: finalExternal.length,
    latency_ms: totalLatency,
    message,
    errors: {
      internal: internalError,
      external: externalError,
    },
    stats: {
      deduped: deduped.droppedDedupe,
      external_stats: externalData?.stats,
    },
  })
}
