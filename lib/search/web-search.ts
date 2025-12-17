import type { SearchResult } from "@/lib/types"

export interface WebSearchOptions {
  query: string
  limit?: number
  signal?: AbortSignal
}

export async function searchWeb(options: WebSearchOptions): Promise<SearchResult[]> {
  const { query, limit = 10, signal } = options

  const key = process.env.GOOGLE_API_KEY
  const cx = process.env.GOOGLE_PSE_ID
  
  if (!key || !cx) {
    console.log("[web-search] Skipping web search - missing configuration:", {
      hasApiKey: !!key,
      hasPseId: !!cx,
    })
    return []
  }

  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1")
    url.searchParams.set("key", key)
    url.searchParams.set("cx", cx)
    url.searchParams.set("q", `${query} events`)
    url.searchParams.set("num", Math.min(limit, 10).toString())

    const response = await fetch(url.toString(), { signal })

    if (!response.ok) {
      console.error("Google PSE error:", response.status, response.statusText)
      return []
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return []
    }

    // Transform Google results to SearchResult format
    return data.items.map((item: any) => {
      // Try to extract date from snippet or metadata
      const dateMatch = item.snippet?.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+ \d{1,2},? \d{4})\b/)
      const extractedDate = dateMatch ? new Date(dateMatch[0]) : null

      return {
        source: "web" as const,
        title: item.title,
        startAt: extractedDate?.toISOString() || new Date().toISOString(),
        url: item.link,
        snippet: item.snippet,
      }
    })
  } catch (error) {
    console.error("Web search error:", error)
    return []
  }
}

export function deduplicateResults(eventaResults: SearchResult[], webResults: SearchResult[]): SearchResult[] {
  const seenTitles = new Set<string>()
  const seenUrls = new Set<string>()
  const deduplicated: SearchResult[] = []

  // Add all Eventa results first
  for (const result of eventaResults) {
    const titleKey = result.title.toLowerCase().trim()
    seenTitles.add(titleKey)

    if (result.url) {
      try {
        const urlObj = new URL(result.url)
        const urlKey = urlObj.origin + urlObj.pathname
        seenUrls.add(urlKey)
      } catch {
        // Invalid URL, skip URL deduplication for this result
      }
    }

    deduplicated.push(result)
  }

  // Add web results that don't match Eventa results
  for (const result of webResults) {
    const titleKey = result.title.toLowerCase().trim()

    let isDuplicate = false

    // Check for exact or very similar titles
    for (const seenKey of seenTitles) {
      if (titleKey === seenKey || titleKey.includes(seenKey) || seenKey.includes(titleKey)) {
        isDuplicate = true
        break
      }
    }

    // Check for duplicate URLs (ignoring query strings)
    if (!isDuplicate && result.url) {
      try {
        const urlObj = new URL(result.url)
        const urlKey = urlObj.origin + urlObj.pathname
        if (seenUrls.has(urlKey)) {
          isDuplicate = true
        }
      } catch {
        // Invalid URL, continue with title-based deduplication only
      }
    }

    if (!isDuplicate) {
      seenTitles.add(titleKey)
      if (result.url) {
        try {
          const urlObj = new URL(result.url)
          const urlKey = urlObj.origin + urlObj.pathname
          seenUrls.add(urlKey)
        } catch {
          // Invalid URL, skip
        }
      }
      deduplicated.push(result)
    }
  }

  return deduplicated
}
