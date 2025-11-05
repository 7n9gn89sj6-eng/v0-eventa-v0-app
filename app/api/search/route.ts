import type { NextRequest } from "next/server"
import { detectLanguage } from "@/lib/search/language-detection"
import { normalizeQuery } from "@/lib/search/query-normalization"
import { searchDatabase } from "@/lib/search/database-search"
import { searchWeb, deduplicateResults } from "@/lib/search/web-search"
import type { SearchResponse } from "@/lib/types"
import { ok, fail } from "@/lib/http"
import { ratelimit } from "@/lib/rate-limit"
import { sanitizeString } from "@/lib/sanitize"

export async function POST(request: NextRequest) {
  try {
    const ip = request.ip ?? "127.0.0.1"
    const { success } = await ratelimit.limit(ip)

    if (!success) {
      return fail("Too many requests", 429)
    }

    const body = await request.json()
    const { query, userLat, userLng, uiLang, filters, includeWeb = false } = body

    if (!query || query.trim().length === 0) {
      return fail("Query is required", 400)
    }

    const sanitizedQuery = sanitizeString(query, 500)

    if (sanitizedQuery.length < 2) {
      return fail("Query too short", 400)
    }

    const langDetected = detectLanguage(sanitizedQuery)

    const normalized = normalizeQuery(sanitizedQuery, langDetected)

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

    let webResults: any[] = []
    const shouldSearchWeb = canWeb && (includeWeb || eventaResults.length < 6)

    if (shouldSearchWeb) {
      webResults = await searchWeb({
        query: normalized.normalized,
        limit: 10,
      })
    }

    const allResults = deduplicateResults(eventaResults, webResults)

    const response: SearchResponse = {
      results: allResults,
      usedWeb: webResults.length > 0,
      webSearchDisabled: !canWeb,
      langDetected: langDetected as any,
      totalResults: allResults.length,
    }

    return ok(response)
  } catch (error) {
    console.error("Search error:", error)
    return fail("Search failed", 500)
  }
}
