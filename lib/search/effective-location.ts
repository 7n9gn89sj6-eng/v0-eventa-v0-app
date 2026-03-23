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
  "festivals",
  "gig",
  "gigs",
  "comedy",
  "dj",
  "events",
  "cheap",
  "free",
  "near",
  "around",
  "where",
  "me",
  "nearby",
  "do",
  "see",
  "hiking",
  "hike",
  "happening",
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

const CALENDAR_MONTH_NAMES = new Set([
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
])

/** True when the captured span is a single calendar month (not a multi-word place). */
export function isCalendarMonthPlace(placeClean: string): boolean {
  const tokens = placeClean.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length !== 1) return false
  return CALENDAR_MONTH_NAMES.has(tokens[0])
}

/** Drop a trailing ` in <month>` so `to Berlin in May` does not become one place span. */
export function trimInMonthTailFromPlace(placeClean: string): string {
  const idx = placeClean.toLowerCase().lastIndexOf(" in ")
  if (idx === -1) return placeClean
  const after = placeClean.slice(idx + 4).trim()
  if (!after) return placeClean.slice(0, idx).trim()
  const headToken = after.split(/\s+/)[0] ?? ""
  if (isCalendarMonthPlace(headToken) || isCalendarMonthPlace(after)) {
    return placeClean.slice(0, idx).trim()
  }
  return placeClean
}

export function countryForKnownCity(city: string): string | null {
  return COUNTRY_BY_CITY[city.toLowerCase()] || null
}

/**
 * True when a Title Case / trailing span is category or intent wording, not a place
 * (e.g. "Music" in "Music this weekend").
 */
export function isQuerySpanNotAPlace(span: string): boolean {
  const t = span.trim().toLowerCase()
  if (t.length < 2) return true
  const tokens = t.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.every(
    (w) => COMMON_NON_LOCATION_WORDS.has(w) || INTENT_PREFIX_WORDS.has(w),
  )
}

/** Shared A4 / extractPlaceFromQuery: month-tail trim then strip trailing today|tonight|tomorrow. */
export function trimPlaceCaptureTail(span: string): string {
  const afterMonth = trimInMonthTailFromPlace(span.trim())
  return afterMonth.replace(/\s+\b(tonight|today|tomorrow)\b$/i, "").trim()
}

/**
 * Extract place from plain-language query using patterns like:
 * - "in X", "near X", "around X", "to X"
 * - "going to X"
 * - "X this weekend"
 */
export function extractPlaceFromQuery(query: string): string | null {
  if (!query) return null

  const patterns = [
    /\bgoing\s+to\s+([A-Za-z][A-Za-z'\\-]*(?:\s+[A-Za-z][A-Za-z'\\-]*){0,2})/gi,
    /\b(in|near|around|to)\s+([A-Za-z][A-Za-z'\\-]*(?:\s+[A-Za-z][A-Za-z'\\-]*){0,2})/gi,
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

      placeClean = trimPlaceCaptureTail(placeClean)
      if (!placeClean || placeClean.length < 2) continue

      // Broad-discovery / question fragments before "this weekend" are not places.
      if (/^what['\u2019]s\b/i.test(placeClean)) continue
      if (/^things\s+to\s+do\b/i.test(placeClean)) continue

      if (COMMON_NON_LOCATION_WORDS.has(placeClean.toLowerCase())) continue
      if (isCalendarMonthPlace(placeClean)) continue
      if (isQuerySpanNotAPlace(placeClean)) continue
      if (/^where\b/i.test(placeClean.trim())) continue

      return placeClean
    }
  }

  return null
}

