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

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const body = await request.json()
  const { entities, query, input_mode = "text", uiLang = "en" } = body

  console.log(`[v0] Dual search request - uiLang: ${uiLang}`, { entities, query })

  // Run both searches in parallel
  const [internalResponse, externalResponse] = await Promise.allSettled([
    fetch(`${request.nextUrl.origin}/api/search/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entities, query, input_mode, uiLang }),
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

  // EVENTS-FIRST: Always prioritize Eventa events
  // Internal results come first, then external (web) results
  // External results are clearly marked as "Related information from the web"
  const mergedResults = [
    ...deduped.internal.map((r) => ({ ...r, source: "internal" as const })),
    ...deduped.external.map((r) => ({ ...r, source: "external" as const, isWebResult: true })),
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
    internal_count: deduped.internal.length,
    external_count: deduped.external.length,
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
