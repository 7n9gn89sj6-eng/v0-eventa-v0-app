export type EffectiveLocationSource = "query" | "ui" | "fallback" | "none"

export type EffectiveLocationResolution = {
  city: string | null
  country: string | null
  source: EffectiveLocationSource
  queryPlace: string | null
}

const COUNTRY_BY_CITY: Record<string, string> = {
  berlin: "Germany",
  paris: "France",
  rome: "Italy",
  london: "United Kingdom",
  "new york": "United States",
  tokyo: "Japan",
  sydney: "Australia",
  melbourne: "Australia",
  brisbane: "Australia",
  perth: "Australia",
  adelaide: "Australia",
  vienna: "Austria",
  madrid: "Spain",
  milan: "Italy",
  athens: "Greece",
  dublin: "Ireland",
  amsterdam: "Netherlands",
  brussels: "Belgium",
  stockholm: "Sweden",
  oslo: "Norway",
  copenhagen: "Denmark",
  lisbon: "Portugal",
  warsaw: "Poland",
  prague: "Czech Republic",
  budapest: "Hungary",
  zurich: "Switzerland",
}

const COMMON_NON_LOCATION_WORDS = new Set([
  "this",
  "that",
  "the",
  "a",
  "an",
  "weekend",
  "week",
  "month",
  "year",
  "today",
  "tomorrow",
  "here",
  "there",
  "music",
  "markets",
  "market",
  "food",
  "art",
  "arts",
  "family",
  "kids",
  "children",
  "sports",
  "sport",
  "concert",
  "live",
  "theatre",
  "theater",
  "exhibition",
  "festival",
  "cheap",
  "free",
  "near",
  "around",
  "me",
  "nearby",
])

const INTENT_PREFIX_WORDS = new Set([
  "music",
  "market",
  "markets",
  "food",
  "art",
  "arts",
  "family",
  "kids",
  "children",
  "sports",
  "sport",
  "concert",
  "live",
  "theatre",
  "theater",
  "exhibition",
  "festival",
  "cheap",
  "free",
  "techno",
  "house",
  "trance",
])

/**
 * Extract place from plain-language query using patterns like:
 * - "in X", "near X", "around X", "to X"
 * - "going to X"
 * - "X this weekend"
 */
export function extractPlaceFromQuery(query: string): string | null {
  if (!query) return null

  const patterns = [
    /\b(in|near|around|to)\s+([A-Za-z][A-Za-z'\\-]*(?:\s+[A-Za-z][A-Za-z'\\-]*){0,2})/gi,
    /\bgoing\s+to\s+([A-Za-z][A-Za-z'\\-]*(?:\s+[A-Za-z][A-Za-z'\\-]*){0,2})/gi,
    /([A-Za-z][a-zA-Z'\\-]*(?:\s+[A-Za-z][a-zA-Z'\\-]*){0,2})\s+this\s+weekend/gi,
  ]

  for (const pattern of patterns) {
    const matches = Array.from(query.matchAll(pattern))
    for (const match of matches) {
      const place = match[match.length - 1]?.trim()
      if (!place) continue

      let placeClean = place.split(/[.,;!?]/)[0].trim()
      if (!placeClean || placeClean.length < 2) continue

      // Strip leading intent token in captures like "techno berlin".
      const tokens = placeClean.split(/\s+/).filter(Boolean)
      if (tokens.length >= 2 && INTENT_PREFIX_WORDS.has(tokens[0].toLowerCase())) {
        const stripped = tokens.slice(1).join(" ").trim()
        if (stripped) placeClean = stripped
      }

      if (!COMMON_NON_LOCATION_WORDS.has(placeClean.toLowerCase())) {
        return placeClean
      }
    }
  }

  return null
}

function resolveCountryForCity(city: string): string | null {
  return COUNTRY_BY_CITY[city.toLowerCase()] || null
}

/**
 * Generic location precedence model (single source of truth):
 * 1) explicit query location
 * 2) selected UI location
 * 3) fallback/default location
 */
export function resolveEffectiveLocation(args: {
  query: string
  selectedCity?: string | null
  selectedCountry?: string | null
  fallbackCity?: string | null
  fallbackCountry?: string | null
}): EffectiveLocationResolution {
  const selectedCity = args.selectedCity?.trim() || null
  const selectedCountry = args.selectedCountry?.trim() || null
  const fallbackCity = args.fallbackCity?.trim() || null
  const fallbackCountry = args.fallbackCountry?.trim() || null

  const locationKeywords = /\b(nearby|near\s+me|around\s+me|close\s+to\s+me|local)\b/i
  const hasLocationKeyword = locationKeywords.test(args.query || "")
  const queryPlace = extractPlaceFromQuery(args.query)

  // Explicit query location always wins, unless it's effectively "near me/here".
  if (queryPlace) {
    const lower = queryPlace.toLowerCase()
    const nearMeToken = lower.includes("me") || lower.includes("here") || lower === "nearby"

    if (!nearMeToken) {
      return {
        city: queryPlace,
        country: resolveCountryForCity(queryPlace),
        source: "query",
        queryPlace,
      }
    }
  }

  if (selectedCity || selectedCountry) {
    return {
      city: selectedCity,
      country: selectedCountry,
      source: "ui",
      queryPlace,
    }
  }

  if (fallbackCity || fallbackCountry || hasLocationKeyword) {
    return {
      city: fallbackCity,
      country: fallbackCountry,
      source: "fallback",
      queryPlace,
    }
  }

  return {
    city: null,
    country: null,
    source: "none",
    queryPlace,
  }
}

