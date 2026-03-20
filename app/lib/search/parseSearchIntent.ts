import {
  countryForKnownCity,
  extractPlaceFromQuery,
  isCalendarMonthPlace,
  isQuerySpanNotAPlace,
  trimPlaceCaptureTail,
} from "@/lib/search/effective-location"
import { parseDateExpression } from "@/lib/search/query-parser"

export type SearchIntent = {
  rawQuery: string

  interest?: string[]
  time?: {
    date_from?: string
    date_to?: string
    label?: string
  }

  place?: {
    city?: string
    region?: string
    country?: string
    raw?: string
  }

  scope: "local" | "city" | "metro" | "region" | "country" | "global" | "broad"

  audience?: string[]
  price?: string[]

  confidence?: number
}

const INTEREST_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(techno|house|trance|dj|live\s+music|music|gig|concert|band)\b/i, value: "music" },
  { pattern: /\b(food|eat|eats|drink|wine|beer|restaurant|dining)\b/i, value: "food" },
  { pattern: /\b(garage\s+sale|flea\s+market|market|markets|bazaar|fair)\b/i, value: "markets" },
  { pattern: /\b(kids|children|family)\b/i, value: "kids" },
  { pattern: /\b(comedy|stand[-\s]?up)\b/i, value: "comedy" },
  { pattern: /\b(art|arts|gallery|exhibition|museum|theatre|theater)\b/i, value: "art" },
  { pattern: /\b(festival|festivals)\b/i, value: "festival" },
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
  if (lower.includes("tonight")) label = "tonight"
  else if (lower.includes("today")) label = "today"
  else if (lower.includes("tomorrow")) label = "tomorrow"
  else if (lower.includes("weekend")) label = "weekend"
  else {
    const weekday = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1]
    if (weekday) label = weekday.toLowerCase()
  }

  return {
    date_from: range.date_from,
    date_to: range.date_to,
    label,
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

function extractPlace(query: string): SearchIntent["place"] {
  const q = query.trim()
  const lower = q.toLowerCase()

  let region: string | undefined
  for (const { pattern, value } of REGION_PATTERNS) {
    if (pattern.test(lower)) {
      region = value
      break
    }
  }

  let country: string | undefined
  for (const { pattern, value } of COUNTRY_PATTERNS) {
    if (pattern.test(lower)) {
      country = value
      break
    }
  }

  let city: string | undefined
  let raw: string | undefined

  const fromPhrase = extractPlaceFromQuery(q)
  if (fromPhrase) {
    let cityRaw = stripCountryTokensFromPlace(fromPhrase, country)
    if (cityRaw) {
      city = titleCaseTokens(cityRaw)
      raw = city
    }
  }

  if (!city) {
    const inPattern = /\b(?:in|at|near|around)\s+([A-Za-z][A-Za-z'\\-]*(?:\s+[A-Za-z][A-Za-z'\\-]*){0,3})\b/gi
    for (const m of q.matchAll(inPattern)) {
      const captured = trimPlaceCaptureTail(m[1]?.trim() ?? "")
      if (!captured || isCalendarMonthPlace(captured)) continue
      if (isQuerySpanNotAPlace(captured)) continue

      let cityRaw = stripCountryTokensFromPlace(captured, country)
      if (!cityRaw) continue

      city = titleCaseTokens(cityRaw)
      raw = captured
      break
    }
  }

  if (!city && !region && !country) {
    const trailing = q.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)
    const candidate = trailing?.[trailing.length - 1]
    if (
      candidate &&
      !/\b(today|tonight|tomorrow|weekend|friday|saturday|sunday)\b/i.test(candidate) &&
      !isCalendarMonthPlace(candidate) &&
      !isQuerySpanNotAPlace(candidate) &&
      countryForKnownCity(candidate) !== null
    ) {
      city = candidate
      raw = candidate
    }
  }

  const inferredCountry = city ? countryForKnownCity(city) : null
  const mergedCountry = country ?? inferredCountry ?? undefined

  if (!city && !region && !mergedCountry && !raw) return undefined

  return {
    city,
    region,
    country: mergedCountry,
    raw: raw || undefined,
  }
}

function detectScope(query: string, place?: SearchIntent["place"]): SearchIntent["scope"] {
  const lower = query.toLowerCase()
  if (/\b(worldwide|anywhere|global)\b/i.test(lower)) return "global"
  if (/\bnear\s+me|around\s+me|nearby|close\s+to\s+me\b/i.test(lower)) return "local"
  if (place?.region) return "region"
  if (place?.country && !place?.city) return "country"
  if (place?.city) return "city"

  if (/\b(things\s+to\s+do|what'?s\s+on|events?)\b/i.test(lower) && !/\bin\s+[a-z]/i.test(lower)) {
    return "broad"
  }

  return "local"
}

export function parseSearchIntent(query: string): SearchIntent {
  const rawQuery = String(query || "").trim()
  const interests = extractInterests(rawQuery)
  const audience = extractAudience(rawQuery)
  const price = extractPrice(rawQuery)
  const time = extractTime(rawQuery)
  const place = extractPlace(rawQuery)
  const scope = detectScope(rawQuery, place)

  let confidence = 0.3
  if (interests.length > 0) confidence += 0.15
  if (time?.date_from || time?.date_to) confidence += 0.2
  if (place?.city || place?.country || place?.region) confidence += 0.2
  if (audience.length > 0 || price.length > 0) confidence += 0.1
  if (scope !== "broad") confidence += 0.1

  return {
    rawQuery,
    interest: interests.length > 0 ? interests : undefined,
    time,
    place,
    scope,
    audience: audience.length > 0 ? audience : undefined,
    price: price.length > 0 ? price : undefined,
    confidence: Math.max(0, Math.min(1, confidence)),
  }
}

