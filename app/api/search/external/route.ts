import { type NextRequest, NextResponse } from "next/server"
import { PROVIDER_WHITELIST, type ProviderName } from "@/lib/external-search/provider-whitelist"
import { validateAndNormalizeExternalEvent } from "@/lib/external-search/schema-validator"
import { checkRateLimit, checkCircuitBreaker, recordFailure, recordSuccess } from "@/lib/external-search/rate-limiter"
import { searchWeb } from "@/lib/search/web-search"

const PROVIDER_TIMEOUT = 1500 // 1.5 seconds

async function fetchFromProvider(
  provider: ProviderName,
  params: { keywords: string[]; category?: string; city?: string; date?: string },
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
    const { keywords = [], category, city, date, uiLang = "en" } = body

    console.log(`[v0] External search request - uiLang: ${uiLang}`, { keywords, category, city, date })

    // Query all whitelisted providers in parallel
    const providerResults = await Promise.all(
      PROVIDER_WHITELIST.map((provider) => fetchFromProvider(provider, { keywords, category, city, date })),
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

    const totalLatency = Date.now() - startTime

    return NextResponse.json({
      results: allResults,
      count: allResults.length,
      latency_ms: totalLatency,
      providers: providerResults,
      stats: {
        total_accepted: totalAccepted,
        dropped_schema: totalDroppedSchema,
        dropped_safety: totalDroppedSafety,
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
