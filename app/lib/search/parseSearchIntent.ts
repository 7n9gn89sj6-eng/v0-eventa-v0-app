import {
  countryForKnownCity,
  extractPlaceFromQuery,
  isCalendarMonthPlace,
  isQuerySpanNotAPlace,
  stripTrailingTimeTokensFromPlaceSpan,
  trimPlaceCaptureTail,
  tryLeadingNonAustraliaKnownCity,
} from "@/lib/search/effective-location"
import { normalizeSearchUtterance, stripTrailingAustralianStateTokens } from "@/lib/search/normalize-search-utterance"
import { parseDateExpression } from "@/lib/search/query-parser"
import type { SearchIntentContext } from "@/lib/search/search-intent-context"
import { extractSearchIntentContext } from "@/lib/search/search-intent-context"
import { extractSubcategoryHints } from "@/lib/search/extract-subcategory-hints"

/** Whether query text clearly names a place (override selected scope) vs weak trailing inference. */
export type PlaceEvidence = "explicit" | "implicit" | "none"

export type SearchIntent = {
  rawQuery: string

  interest?: string[]
  time?: {
    date_from?: string
    date_to?: string
    label?: string
    timeWasRolledForward?: boolean
    relativeWindowType?: string
  }

  place?: {
    city?: string
    region?: string
    country?: string
    raw?: string
  }

  /** Precedence: only `explicit` query geography overrides URL/picker location in `resolveSearchPlan`. */
  placeEvidence: PlaceEvidence

  scope: "local" | "city" | "region" | "country" | "global" | "broad"

  audience?: string[]
  price?: string[]

  /** Activity/context facets (closed vocabulary); not categories and not place. */
  context?: SearchIntentContext[]

  /** Deterministic sub-category hint IDs (`lib/categories/event-subcategories.ts`); ranking only. */
  subcategoryHints?: string[]

  /**
   * User asked for past/archive-style content; default-forward stale suppression (e.g. web visible-year) should relax.
   * Set from normalized query only; same semantics everywhere this flag is read.
   */
  wantsPastOrHistory?: boolean

  confidence?: number
}

const INTEREST_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(techno|house|trance|dj|live\s+music|music|gig|concert|band)\b/i, value: "music" },
  { pattern: /\b(food|eat|eats|drink|wine|beer|restaurant|dining)\b/i, value: "food" },
  { pattern: /\b(garage\s+sale|flea\s+market|market|markets|bazaar|fair)\b/i, value: "markets" },
  { pattern: /\b(kids|children|family)\b/i, value: "kids" },
  { pattern: /\b(comedy|stand[-\s]?up)\b/i, value: "comedy" },
  { pattern: /\b(theatre|theater|musical|west\s+end)\b/i, value: "theatre" },
  { pattern: /\b(art|arts|gallery|exhibition|museum)\b/i, value: "art" },
  { pattern: /\b(festival|festivals)\b/i, value: "festival" },
  {
    pattern: /\b(sport|sports|fitness|run|running|yoga|hyrox|spartan\s+race)\b/i,
    value: "sports",
  },
  { pattern: /\b(community|volunteer|charity)\b/i, value: "community" },
  { pattern: /\b(learn|talk|workshop|course)\b/i, value: "learning" },
]

const REGION_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bwestern\s+europe\b/i, value: "Western Europe" },
  { pattern: /\beastern\s+europe\b/i, value: "Eastern Europe" },
  { pattern: /\bsouthern\s+europe\b/i, value: "Southern Europe" },
  { pattern: /\bnorthern\s+europe\b/i, value: "Northern Europe" },
  { pattern: /\beurope\b/i, value: "Europe" },
  { pattern: /\bscandinavia\b/i, value: "Scandinavia" },
  { pattern: /\bmiddle\s+east\b/i, value: "Middle East" },
  { pattern: /\bsouth\s+america\b/i, value: "South America" },
  { pattern: /\bnorth\s+america\b/i, value: "North America" },
  { pattern: /\bwestern\s+australia\b/i, value: "Western Australia" },
]

const COUNTRY_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(australia|au)\b/i, value: "Australia" },
  { pattern: /\b(germany)\b/i, value: "Germany" },
  { pattern: /\b(united\s+kingdom|uk)\b/i, value: "United Kingdom" },
  { pattern: /\b(united\s+states|usa|us)\b/i, value: "United States" },
  { pattern: /\b(france)\b/i, value: "France" },
  { pattern: /\b(italy)\b/i, value: "Italy" },
  { pattern: /\b(spain)\b/i, value: "Spain" },
  { pattern: /\b(greece)\b/i, value: "Greece" },
  { pattern: /\b(portugal)\b/i, value: "Portugal" },
]

function dedupe(values: string[]): string[] {
  return [...new Set(values)]
}

/** True when normalized query clearly asks for past or archival results (not general "history" topics). */
export function extractWantsPastOrHistory(normalizedQuery: string): boolean {
  const s = normalizedQuery.trim()
  if (!s) return false
  return /\b(past\s+events?|archive|archives|historical|history\s+of|retro|old\s+events?|previous\s+years?)\b/i.test(
    s,
  )
}

function extractInterests(query: string): string[] {
  const hits: string[] = []
  for (const { pattern, value } of INTEREST_PATTERNS) {
    if (pattern.test(query)) hits.push(value)
  }
  return dedupe(hits)
}

function extractAudience(query: string): string[] {
  const values: string[] = []
  if (/\b(kids|children|family)\b/i.test(query)) values.push("family")
  if (/\b(adults?|grown[-\s]?ups?)\b/i.test(query)) values.push("adults")
  return dedupe(values)
}

function extractPrice(query: string): string[] {
  const values: string[] = []
  if (/\bfree\b/i.test(query)) values.push("free")
  if (/\bcheap|budget|low\s*cost\b/i.test(query)) values.push("cheap")
  return dedupe(values)
}

function extractTime(query: string): SearchIntent["time"] {
  const range = parseDateExpression(query)
  if (!range.date_from && !range.date_to) return undefined

  let label: string | undefined
  const lower = query.toLowerCase()
  if (/\beaster\b/.test(lower)) {
    if (/\beaster\s+long\s+weekend\b/.test(lower)) label = "easter long weekend"
    else if (/\beaster\s+weekend\b/.test(lower)) label = "easter weekend"
    else label = "easter"
  } else if (lower.includes("tonight")) label = "tonight"
  else if (lower.includes("today")) label = "today"
  else if (lower.includes("tomorrow")) label = "tomorrow"
  else if (/\bnext\s+weekend\b/.test(lower)) label = "next weekend"
  else if (lower.includes("weekend")) label = "weekend"
  else {
    const weekday = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1]
    if (weekday) label = weekday.toLowerCase()
    else {
      const inMonth = lower.match(
        /\bin\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?\b/,
      )
      if (inMonth) {
        label = inMonth[2] ? `${inMonth[1]} ${inMonth[2]}` : inMonth[1]
      } else {
        const monthYear = lower.match(
          /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})\b/,
        )
        if (monthYear) label = `${monthYear[1]} ${monthYear[2]}`
        else {
          const trailing = lower.match(
            /\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*$/i,
          )
          if (trailing) label = trailing[1].toLowerCase()
        }
      }
    }
  }

  return {
    date_from: range.date_from,
    date_to: range.date_to,
    label,
    timeWasRolledForward: range.timeWasRolledForward,
    relativeWindowType: range.relativeWindowType,
  }
}

function titleCaseTokens(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(" ")
}

function stripCountryTokensFromPlace(cityRaw: string, countryLabel: string | undefined): string {
  if (!countryLabel) return cityRaw
  return cityRaw
    .replace(/\b(united\s+kingdom|uk|united\s+states|usa|us|australia|germany|france|italy|spain|greece|portugal)\b/gi, "")
    .trim()
}

/** True when `candidate` is a suffix of the trimmed query (e.g. "… Berlin" but not "Richmond jazz"). */
function isPlaceSuffixAnchored(query: string, candidate: string): boolean {
  const qn = query.trim().replace(/[.,;!?]+$/g, "").trim()
  const cn = candidate.trim().replace(/[.,;!?]+$/g, "").trim()
  if (!cn.length) return false
  return qn.toLowerCase().endsWith(cn.toLowerCase())
}

function extractPlaceWithEvidence(query: string): {
  place: SearchIntent["place"] | undefined
  placeEvidence: PlaceEvidence
} {
  const q = query.trim()
  const lower = q.toLowerCase()

  let geoEvidence: PlaceEvidence = "none"

  let region: string | undefined
  for (const { pattern, value } of REGION_PATTERNS) {
    if (pattern.test(lower)) {
      region = value
      geoEvidence = "explicit"
      break
    }
  }

  let country: string | undefined
  for (const { pattern, value } of COUNTRY_PATTERNS) {
    if (pattern.test(lower)) {
      country = value
      geoEvidence = "explicit"
      break
    }
  }

  let city: string | undefined
  let raw: string | undefined

  const leadingOverseas = tryLeadingNonAustraliaKnownCity(q)
  if (leadingOverseas) {
    city = leadingOverseas.city
    raw = leadingOverseas.raw
    country = country ?? leadingOverseas.country
    geoEvidence = "explicit"
  }

  const fromPhrase = !city ? extractPlaceFromQuery(q) : null
  if (fromPhrase) {
    let cityRaw = stripCountryTokensFromPlace(fromPhrase, country)
    if (cityRaw) {
      city = titleCaseTokens(cityRaw)
      raw = city
      geoEvidence = "explicit"
    }
  }

  if (!city) {
    const inPattern = /\b(?:in|at|near|around)\s+([A-Za-z][A-Za-z'\\-]*(?:\s+[A-Za-z][A-Za-z'\\-]*){0,3})\b/gi
    for (const m of q.matchAll(inPattern)) {
      const captured = stripTrailingTimeTokensFromPlaceSpan(trimPlaceCaptureTail(m[1]?.trim() ?? ""))
      if (!captured || isCalendarMonthPlace(captured)) continue
      if (isQuerySpanNotAPlace(captured)) continue
      // "near where I'm hiking" → not a place name
      if (/^where\b/i.test(captured.trim())) continue

      let cityRaw = stripCountryTokensFromPlace(captured, country)
      if (!cityRaw) continue

      city = titleCaseTokens(cityRaw)
      raw = city
      geoEvidence = "explicit"
      break
    }
  }

  if (!city && !region && !country) {
    const trailing = q.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)
    const candidate = trailing?.[trailing.length - 1]
    if (
      candidate &&
      !/\b(today|tonight|tomorrow|weekend|friday|saturday|sunday|easter)\b/i.test(candidate) &&
      !isCalendarMonthPlace(candidate) &&
      !isQuerySpanNotAPlace(candidate) &&
      countryForKnownCity(candidate) !== null
    ) {
      city = candidate
      raw = candidate
      if (isPlaceSuffixAnchored(q, candidate)) {
        if (geoEvidence === "none") geoEvidence = "explicit"
      } else if (geoEvidence === "none") {
        geoEvidence = "implicit"
      }
    }
  }

  const inferredCountry = city ? countryForKnownCity(city) : null
  const mergedCountry = country ?? inferredCountry ?? undefined

  if (!city && !region && !mergedCountry && !raw) {
    return { place: undefined, placeEvidence: "none" }
  }

  let cityOut = city
  if (cityOut && mergedCountry === "Australia") {
    cityOut = stripTrailingAustralianStateTokens(cityOut)
  }

  return {
    place: {
      city: cityOut,
      region,
      country: mergedCountry,
      raw: raw || undefined,
    },
    placeEvidence: geoEvidence,
  }
}

function detectScope(query: string, place?: SearchIntent["place"]): SearchIntent["scope"] {
  const lower = query.toLowerCase()
  if (/\b(worldwide|anywhere|global)\b/i.test(lower)) return "global"
  if (/\bnear\s+me|around\s+me|nearby|close\s+to\s+me\b/i.test(lower)) return "local"
  if (place?.region) return "region"
  if (place?.country && !place?.city) return "country"
  if (place?.city) return "city"

  if (
    /\b(things\s+to\s+do|what'?s\s+on|what'?s\s+happening|what'?s\s+going\s+on|events?)\b/i.test(lower) &&
    !/\bin\s+[a-z]/i.test(lower)
  ) {
    return "broad"
  }

  return "local"
}

/**
 * Maps multi-interest app intent to a single ranking category (aligned with score-search-result keys).
 */
export function rankingCategoryFromParsedIntent(intent: SearchIntent): string | undefined {
  const list = intent.interest ?? []
  const priority: Array<{ key: string; category: string }> = [
    { key: "markets", category: "markets" },
    { key: "music", category: "music" },
    { key: "food", category: "food" },
    { key: "sports", category: "sports" },
    { key: "theatre", category: "theatre" },
    { key: "art", category: "arts" },
    { key: "kids", category: "family" },
    { key: "comedy", category: "comedy" },
    { key: "festival", category: "festivals" },
    { key: "community", category: "community" },
    { key: "learning", category: "learning" },
  ]
  for (const { key, category } of priority) {
    if (list.includes(key)) return category
  }
  return undefined
}

export function parseSearchIntent(query: string): SearchIntent {
  const rawQuery = String(query || "").trim()
  const nq = normalizeSearchUtterance(rawQuery)
  const interests = extractInterests(nq)
  const subcategoryHints = extractSubcategoryHints(nq, interests)
  const audience = extractAudience(nq)
  const price = extractPrice(nq)
  const time = extractTime(nq)
  const { place, placeEvidence } = extractPlaceWithEvidence(nq)
  const scope = detectScope(nq, place)
  const context = extractSearchIntentContext(nq)
  const wantsPastOrHistory = extractWantsPastOrHistory(nq)

  let confidence = 0.3
  if (interests.length > 0) confidence += 0.15
  if (time?.date_from || time?.date_to) confidence += 0.2
  if (place?.city || place?.country || place?.region) confidence += 0.2
  if (audience.length > 0 || price.length > 0) confidence += 0.1
  if (context.length > 0) confidence += 0.05
  if (scope !== "broad") confidence += 0.1

  return {
    rawQuery,
    interest: interests.length > 0 ? interests : undefined,
    time,
    place,
    placeEvidence,
    scope,
    audience: audience.length > 0 ? audience : undefined,
    price: price.length > 0 ? price : undefined,
    context: context.length > 0 ? context : undefined,
    subcategoryHints: subcategoryHints.length > 0 ? subcategoryHints : undefined,
    wantsPastOrHistory: wantsPastOrHistory ? true : undefined,
    confidence: Math.max(0, Math.min(1, confidence)),
  }
}

