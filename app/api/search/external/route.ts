import { type NextRequest, NextResponse } from "next/server"
import { PROVIDER_WHITELIST, type ProviderName } from "@/lib/external-search/provider-whitelist"
import { validateAndNormalizeExternalEvent } from "@/lib/external-search/schema-validator"
import { checkRateLimit, checkCircuitBreaker, recordFailure, recordSuccess } from "@/lib/external-search/rate-limiter"

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

    const accepted = validated.filter((v) => v.event !== null).map((v) => v.event!)
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
  // In production, this would call actual provider APIs
  // For now, return stub data based on provider

  if (provider === "stub_web") {
    return [
      {
        title: "Summer Music Festival",
        description: "Annual outdoor music festival featuring local and international artists",
        startAt: new Date("2025-07-15T18:00:00Z").toISOString(),
        city: "Athens",
        venue: "Olympic Stadium",
        category: "Music",
        sourceUrl: "https://example.com/summer-festival",
      },
      {
        title: "Tech Innovation Summit",
        description: "Leading technology conference with keynotes and workshops",
        startAt: new Date("2025-08-20T09:00:00Z").toISOString(),
        city: "Melbourne",
        venue: "Convention Centre",
        category: "Technology",
        sourceUrl: "https://example.com/tech-summit",
      },
    ]
  }

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
