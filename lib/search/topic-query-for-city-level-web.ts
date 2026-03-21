import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"
import type { SearchPlan } from "@/app/lib/search/resolveSearchPlan"

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Remove one token or phrase match with word boundaries; collapse whitespace. */
export function stripPlaceTokenFromQuery(q: string, token: string): string {
  const t = token.trim()
  if (!t) return q

  const words = t.split(/\s+/).filter(Boolean)
  let out = q
  if (words.length === 1) {
    const re = new RegExp(`\\b${escapeRegExp(words[0])}\\b`, "gi")
    out = out.replace(re, " ")
  } else {
    const pattern = words.map((w) => escapeRegExp(w)).join("\\s+")
    const re = new RegExp(`\\b${pattern}\\b`, "gi")
    out = out.replace(re, " ")
  }
  return out.replace(/\s+/g, " ").trim()
}

type LocationSource = SearchPlan["location"]["source"]

/**
 * Base string for city-level CSE queries: when execution stayed on the URL/picker (`selected`)
 * and the parser only inferred a weak place (`implicit`), drop that token from the raw query so
 * we do not send "Brisbane … Melbourne" style strings. Explicit query geography leaves `q` intact.
 */
export function topicQueryForCityLevelWeb(
  q: string,
  intent: SearchIntent,
  locationSource: LocationSource,
): string {
  if (locationSource !== "selected") return q
  if (intent.placeEvidence !== "implicit") return q

  const raw = intent.place?.raw?.trim()
  const city = intent.place?.city?.trim()
  if (!raw && !city) return q

  let result = q
  const stripped = new Set<string>()

  if (raw) {
    result = stripPlaceTokenFromQuery(result, raw)
    stripped.add(raw.toLowerCase())
  }
  if (city && !stripped.has(city.toLowerCase())) {
    result = stripPlaceTokenFromQuery(result, city)
  }

  if (!result.trim()) return q
  return result
}
