import type { MapboxFeature } from "@/lib/geocoding"

/** True when the query looks like it starts with a house/street number (e.g. "23 Barkly Street …"). */
export function queryHasLeadingStreetNumber(q: string): boolean {
  return /^\s*\d+[a-zA-Z]?\s+\S/.test(String(q || "").trim())
}

function leadingNumberToken(q: string): string | null {
  const m = String(q || "")
    .trim()
    .match(/^(\d+[a-zA-Z]?)\b/i)
  return m ? m[1]!.toLowerCase() : null
}

/**
 * After Mapbox forward suggest: when the user typed a numbered address, prefer features whose
 * {@code place_name} / {@code text} include that number over street-only or admin-area results.
 * Does not change Mapbox API scoring alone — reorders the same feature set for the UI.
 */
export function sortMapboxSuggestFeatures(query: string, features: MapboxFeature[]): MapboxFeature[] {
  const list = [...features]
  if (!queryHasLeadingStreetNumber(query)) return list

  const numToken = leadingNumberToken(query)
  if (!numToken) return list

  const scored = list.map((f, idx) => {
    let score = (typeof f.relevance === "number" ? f.relevance : 0.5) * 10
    const pn = (f.place_name || "").toLowerCase()
    const tx = (f.text || "").toLowerCase()
    const primary = f.place_type?.[0] || ""

    if (pn.includes(numToken)) score += 100
    if (tx.startsWith(numToken) || tx.includes(`${numToken} `) || tx.includes(`${numToken},`)) score += 85
    if (primary === "address") score += 45
    if (primary === "poi") score += 12
    // Street-level address line that does not contain the requested street number — deprioritise.
    if (primary === "address" && !pn.includes(numToken) && !tx.includes(numToken)) score -= 130
    if (primary === "place" || primary === "locality" || primary === "neighborhood") score -= 70

    return { f, score, idx }
  })

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return scored.map((s) => s.f)
}

/** Short label so users can tell address vs street segment vs area. */
export function suggestKindLabel(placeType: string | undefined): string {
  switch (placeType) {
    case "address":
      return "Address"
    case "poi":
      return "Venue or place"
    case "place":
      return "City or town"
    case "locality":
      return "Suburb"
    case "neighborhood":
      return "Neighborhood"
    case "district":
      return "District"
    case "region":
      return "Region"
    case "postcode":
      return "Postcode"
    case "country":
      return "Country"
    default:
      return "Location"
  }
}
