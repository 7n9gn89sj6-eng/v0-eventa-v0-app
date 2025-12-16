import type { NextRequest } from "next/server"
import { detectLanguage } from "@/lib/search/language-detection"
import { normalizeQuery } from "@/lib/search/query-normalization"
import { searchDatabase } from "@/lib/search/database-search"
import { searchWeb, deduplicateResults } from "@/lib/search/web-search"
import { ok, fail } from "@/lib/http"
import { logger } from "@/lib/logger"
import { checkRateLimit, getClientIdentifier, rateLimiters } from "@/lib/rate-limit"
import type { SearchFilters, SearchResult } from "@/lib/types"

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let body: any = null
  
  try {
    // Check rate limit
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await checkRateLimit(clientId, rateLimiters.search)
    
    if (!rateLimitResult.success) {
      logger.warn("[search] Rate limit exceeded", {
        clientId,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset,
      })
      return fail(
        `Rate limit exceeded. Please try again in ${rateLimitResult.reset ? Math.ceil((rateLimitResult.reset - Date.now()) / 1000) : 'a few'} seconds.`,
        429
      )
    }

    body = await request.json()
    const { query, userLat, userLng, uiLang, filters, includeWeb = false } = body

    if (!query || query.trim().length === 0) {
      return fail("Query is required", 400)
    }
    logger.info("[search] Request received", { query, userLat, userLng, filters, includeWeb })

    const langDetected = detectLanguage(query)
    logger.debug("[search] Language detected", { lang: langDetected })

    const normalized = normalizeQuery(query, langDetected)
    logger.debug("[search] Query normalized", normalized)

    const key = process.env.GOOGLE_API_KEY
    const cx = process.env.GOOGLE_PSE_ID
    const canWeb = Boolean(key && cx)

    // Step 3: Search Eventa database
    const eventaResults = await searchDatabase({
      query: normalized.normalized,
      synonyms: normalized.synonyms,
      categories: normalized.categories,
      filters,
      userLat,
      userLng,
      limit: 20,
    })

    logger.info("[search] Database results", { count: eventaResults.length })

    let webResults: SearchResult[] = []
    const shouldSearchWeb = canWeb && (includeWeb || eventaResults.length < 6)

    if (shouldSearchWeb) {
      logger.debug("[search] Searching web")
      webResults = await searchWeb({
        query: normalized.normalized,
        limit: 10,
      })
      logger.info("[search] Web results", { count: webResults.length })
    }

    const allResults = deduplicateResults(eventaResults, webResults)
    const duration = Date.now() - startTime
    logger.info("[search] Search completed", { 
      totalResults: allResults.length,
      databaseResults: eventaResults.length,
      webResults: webResults.length,
      durationMs: duration,
    })

    return ok(allResults)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const duration = Date.now() - startTime
    
    logger.error("[search] Search failed", error, {
      query: body?.query,
      filters: body?.filters,
      durationMs: duration,
    })
    
    // Return more specific error messages based on error type
    if (errorMessage.includes("database") || errorMessage.includes("prisma") || errorMessage.includes("DATABASE")) {
      return fail("Database search unavailable. Please try again later.", 503)
    }
    
    if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
      return fail("Search request timed out. Please try again.", 504)
    }
    
    // In development, include error details
    if (process.env.NODE_ENV === "development") {
      return fail(`Search failed: ${errorMessage}`, 500)
    }
    
    return fail("Search failed. Please try again.", 500)
  }
}
