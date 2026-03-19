import type { SearchIntent } from "./parseSearchIntent"

export type SearchPlan = {
  location: {
    city?: string
    country?: string
    region?: string
    source: "query" | "selected" | "fallback" | "none"
  }
  scope: SearchIntent["scope"]
  interests: string[]
  time: {
    date_from?: string
    date_to?: string
    label?: string
  }
  audience: string[]
  price: string[]
  filters: {
    strictCategory: boolean
    applyLocationRestriction: boolean
  }
}

/**
 * Resolve intent + ambient context into one search plan.
 * Rules:
 * 1) Query place overrides selected location.
 * 2) Scope controls breadth.
 * 3) Broad scope should rank by category instead of strict filtering.
 */
export function resolveSearchPlan(
  intent: SearchIntent,
  selectedLocation: {
    city?: string
    country?: string
  } | null,
): SearchPlan {
  const queryCity = intent.place?.city?.trim()
  const queryCountry = intent.place?.country?.trim()
  const queryRegion = intent.place?.region?.trim()

  const selectedCity = selectedLocation?.city?.trim()
  const selectedCountry = selectedLocation?.country?.trim()

  const hasQueryPlace = Boolean(queryCity || queryCountry || queryRegion)
  const locationSource: SearchPlan["location"]["source"] = hasQueryPlace
    ? "query"
    : selectedCity || selectedCountry
      ? "selected"
      : "none"

  // Explicit query place fully overrides ambient selected location.
  const city = hasQueryPlace ? queryCity : selectedCity
  const country = hasQueryPlace ? queryCountry : selectedCountry

  const location: SearchPlan["location"] = {
    city: city || undefined,
    country: country || undefined,
    region: queryRegion || undefined,
    source: locationSource,
  }

  const scope = intent.scope
  const strictCategory = scope !== "broad"
  const applyLocationRestriction = scope !== "global"

  return {
    location,
    scope,
    interests: intent.interest ?? [],
    time: {
      date_from: intent.time?.date_from,
      date_to: intent.time?.date_to,
      label: intent.time?.label,
    },
    audience: intent.audience ?? [],
    price: intent.price ?? [],
    filters: {
      strictCategory,
      applyLocationRestriction,
    },
  }
}

