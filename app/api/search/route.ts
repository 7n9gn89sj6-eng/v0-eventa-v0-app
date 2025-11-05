import type { NextRequest } from "next/server"
import { detectLanguage } from "@/lib/search/language-detection"
import { normalizeQuery } from "@/lib/search/query-normalization"
import { searchDatabase } from "@/lib/search/database-search"
import { searchWeb, deduplicateResults } from "@/lib/search/web-search"
import type { SearchResponse } from "@/lib/types"
import { ok, fail } from "@/lib/http"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, userLat, userLng, uiLang, filters, includeWeb = false } = body

    if (!query || query.trim().length === 0) {
      return fail("Query is required", 400)
    }

    console.log("[v0] Search request:", { query, userLat, userLng, filters, includeWeb })

    const langDetected = detectLanguage(query)
    console.log("[v0] Detected language:", langDetected)

    const normalized = normalizeQuery(query, langDetected)
    console.log("[v0] Normalized query:", normalized)

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

    console.log("[v0] Found", eventaResults.length, "Eventa results")

    let webResults: any[] = []
    const shouldSearchWeb = canWeb && (includeWeb || eventaResults.length < 6)

    if (shouldSearchWeb) {
      console.log("[v0] Searching web...")
      webResults = await searchWeb({
        query: normalized.normalized,
        limit: 10,
      })
      console.log("[v0] Found", webResults.length, "web results")
    }

    const allResults = deduplicateResults(eventaResults, webResults)
    console.log("[v0] Total results after deduplication:", allResults.length)

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
