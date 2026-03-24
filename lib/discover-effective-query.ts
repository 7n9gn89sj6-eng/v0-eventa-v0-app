/**
 * Client-side normalization so structured Discover filters (category, place) can override
 * stale free-text intent without ad-hoc string hacks in the component.
 *
 * Mirrors interest patterns from `app/lib/search/parseSearchIntent.ts` (keep in sync).
 */
import { parseSearchIntent, type SearchIntent } from "@/app/lib/search/parseSearchIntent"
import { normalizeSearchUtterance } from "@/lib/search/normalize-search-utterance"
import { countryForKnownCity } from "@/lib/search/effective-location"

const INTEREST_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(techno|house|trance|dj|live\s+music|music|gig|concert|band)\b/gi, value: "music" },
  { pattern: /\b(food|eat|eats|drink|wine|beer|restaurant|dining)\b/gi, value: "food" },
  { pattern: /\b(garage\s+sale|flea\s+market|market|markets|bazaar|fair)\b/gi, value: "markets" },
  { pattern: /\b(kids|children|family)\b/gi, value: "kids" },
  { pattern: /\b(comedy|stand[-\s]?up)\b/gi, value: "comedy" },
  { pattern: /\b(art|arts|gallery|exhibition|museum|theatre|theater)\b/gi, value: "art" },
  { pattern: /\b(festival|festivals)\b/gi, value: "festival" },
  { pattern: /\b(sport|sports|fitness|run|running|yoga)\b/gi, value: "sports" },
  { pattern: /\b(community|volunteer|charity)\b/gi, value: "community" },
  { pattern: /\b(learn|talk|workshop|course)\b/gi, value: "learning" },
]

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Which parseSearchIntent `interest` values may remain when a structured UI category is active. */
function allowedInterestValuesForUiCategory(uiCategory: string): Set<string> | null {
  if (uiCategory === "All") return null
  const map: Record<string, string[]> = {
    Music: ["music"],
    Food: ["food"],
    Arts: ["art"],
    Markets: ["markets"],
    Community: ["kids"],
    Sports: [],
    Tech: [],
    Business: [],
    Health: [],
    Education: [],
    Other: [],
  }
  return new Set(map[uiCategory] ?? [])
}

function stripConflictingInterestTerms(raw: string, uiCategory: string): string {
  const allowed = allowedInterestValuesForUiCategory(uiCategory)
  if (allowed === null) return raw
  let out = raw
  for (const { pattern, value } of INTEREST_PATTERNS) {
    if (!allowed.has(value)) {
      out = out.replace(pattern, " ")
    }
  }
  return collapseWhitespace(out)
}

function queryPlaceConflictsWithStructuredLocation(
  parsed: SearchIntent,
  uiCity: string,
  uiCountry: string,
): boolean {
  const primaryPlace = primaryPlaceLabelForComparison(parsed.place)
  const pc = primaryPlace?.toLowerCase() ?? ""
  const pco = parsed.place?.country?.trim().toLowerCase() ?? ""
  const uc = uiCity.trim().toLowerCase()
  const uco = uiCountry.trim().toLowerCase()
  if (uc && pc && pc !== uc) return true
  if (uco && pco && pco !== uco) return true
  return false
}

/** Parser sometimes appends time phrases to `place.city` ("Paris This Weekend"); strip for comparison/removal. */
function stripTrailingTimePhrasesFromPlaceLabel(label: string): string {
  return label
    .replace(/\s+this\s+weekend$/i, "")
    .replace(/\s+next\s+weekend$/i, "")
    .replace(/\s+this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i, "")
    .replace(/\s+next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i, "")
    .replace(/\s+(?:tonight|today|tomorrow)$/i, "")
    .trim()
}

function primaryPlaceLabelForComparison(place: NonNullable<SearchIntent["place"]>): string {
  const base = (place.raw?.trim() || place.city?.trim() || "").trim()
  return stripTrailingTimePhrasesFromPlaceLabel(base)
}

function uniquePlaceRemovalSpans(place: NonNullable<SearchIntent["place"]>): string[] {
  const raw = [place.raw, place.city]
    .filter(Boolean)
    .map((s) => stripTrailingTimePhrasesFromPlaceLabel(String(s).trim()))
    .filter((s) => s.length > 0)
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of raw) {
    const k = s.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(s)
    }
  }
  return out
}

function removeParsedPlaceFromQuery(query: string, place: NonNullable<SearchIntent["place"]>): string {
  let out = query
  const spans = uniquePlaceRemovalSpans(place)
  for (const span of spans) {
    const e = escapeRegExp(span)
    out = out.replace(new RegExp(`\\b(?:in|at|near|around)\\s+${e}\\b`, "gi"), " ")
    out = out.replace(new RegExp(`\\b${e}\\b`, "gi"), " ")
  }
  const country = place.country?.trim()
  const primary = spans[0]
  if (country && primary && country.toLowerCase() !== primary.toLowerCase()) {
    const ec = escapeRegExp(country)
    out = out.replace(new RegExp(`\\b${ec}\\b`, "gi"), " ")
  }
  return collapseWhitespace(out)
}

export type NormalizeDiscoverQueryArgs = {
  rawQuery: string
  selectedCategory: string
  cityFilter: string
  countryFilter: string
  structuredCategoryAuthoritative: boolean
  structuredLocationAuthoritative: boolean
}

export type DiscoverApiSearchParams = {
  apiQuery: string
  city: string
  country: string
}

/**
 * Resolves `query`, `city`, and `country` for GET `/api/search/events` and Discover URL sync.
 *
 * Rule: if the query has **explicit** geography that **conflicts** with non-empty UI city/country,
 * use the parsed query place for this request (and keep place tokens in `apiQuery`). Otherwise
 * keep UI filters; when structured location is authoritative, strip conflicting implicit place
 * tokens from the query text (Brisbane + Melbourne, etc.).
 */
export function resolveDiscoverApiSearchParams(args: NormalizeDiscoverQueryArgs): DiscoverApiSearchParams {
  const {
    rawQuery,
    selectedCategory,
    cityFilter,
    countryFilter,
    structuredCategoryAuthoritative,
    structuredLocationAuthoritative,
  } = args

  let out = normalizeSearchUtterance(String(rawQuery || "").trim())

  if (structuredCategoryAuthoritative && selectedCategory !== "All") {
    out = stripConflictingInterestTerms(out, selectedCategory)
  }
  out = collapseWhitespace(out)

  const parsed = out ? parseSearchIntent(out) : parseSearchIntent("")
  const uiCity = cityFilter.trim()
  const uiCountry = countryFilter.trim()
  const hasUiPlace = uiCity.length > 0 || uiCountry.length > 0

  if (
    parsed.placeEvidence === "explicit" &&
    parsed.place?.city?.trim() &&
    hasUiPlace &&
    queryPlaceConflictsWithStructuredLocation(parsed, cityFilter, countryFilter)
  ) {
    const city = parsed.place.city.trim()
    const country =
      (parsed.place.country ?? "").trim() || (countryForKnownCity(city) ?? "").trim()
    return { apiQuery: out, city, country }
  }

  const hasStructuredPlace =
    structuredLocationAuthoritative && (uiCity.length > 0 || uiCountry.length > 0)

  let apiQuery = out
  if (hasStructuredPlace && parsed.place && queryPlaceConflictsWithStructuredLocation(parsed, cityFilter, countryFilter)) {
    apiQuery = collapseWhitespace(removeParsedPlaceFromQuery(out, parsed.place))
  }

  return {
    apiQuery,
    city: uiCity,
    country: uiCountry,
  }
}

/**
 * Produce the `query` string to send to `/api/search/events` (and mirror into URL `q` when filters change).
 */
export function normalizeDiscoverFreeTextForStructuredFilters(args: NormalizeDiscoverQueryArgs): string {
  return resolveDiscoverApiSearchParams(args).apiQuery
}
