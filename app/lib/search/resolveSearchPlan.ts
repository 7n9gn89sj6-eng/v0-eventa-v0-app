import type { SearchIntent } from "./parseSearchIntent"
import { resolveRegionCountries } from "@/lib/search/region-map"

export type SearchPlan = {
  location: {
    city?: string | null
    country?: string | null
    region?: string | null
    countries?: string[]
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
 *
 * Rules:
 * - Query geography overrides selected UI location only when `intent.placeEvidence === "explicit"`.
 * - Weak/implicit query place (e.g. non-anchored trailing city) keeps URL/picker scope.
 * - Region scope: resolve to `location.countries`; never use selected UI city/country.
 * - Global scope: no structured location restriction at execution time.
 */
export function resolveSearchPlan(
  intent: SearchIntent,
  selectedLocation: {
    city?: string
    country?: string
  } | null,
): SearchPlan {
  const scope = intent.scope
  const queryCity = intent.place?.city?.trim()
  const queryCountry = intent.place?.country?.trim()
  const queryRegion = intent.place?.region?.trim()

  const selectedCity = selectedLocation?.city?.trim()
  const selectedCountry = selectedLocation?.country?.trim()

  const hasGeographicQuery = Boolean(queryCity || queryCountry || queryRegion)
  const explicitQueryOverrides =
    intent.placeEvidence === "explicit" && hasGeographicQuery

  let source: SearchPlan["location"]["source"] = explicitQueryOverrides
    ? "query"
    : selectedCity || selectedCountry
      ? "selected"
      : "none"

  let city: string | null | undefined
  let country: string | null | undefined
  let region: string | null | undefined
  let countries: string[] | undefined

  if (scope === "global") {
    city = undefined
    country = undefined
    region = undefined
    countries = undefined
  } else if (scope === "region") {
    region = queryRegion || undefined
    countries = queryRegion ? resolveRegionCountries(queryRegion) ?? undefined : undefined
    city = undefined
    country = undefined
    source = queryRegion ? "query" : "none"
  } else if (explicitQueryOverrides) {
    city = queryCity || undefined
    country = queryCountry || undefined
    region = queryRegion || undefined
    countries = queryRegion ? resolveRegionCountries(queryRegion) ?? undefined : undefined
    source = "query"
  } else {
    city = selectedCity || undefined
    country = selectedCountry || undefined
    source = selectedCity || selectedCountry ? "selected" : "none"
  }

  const strictCategory = scope !== "broad"
  const applyLocationRestriction = scope !== "global"

  return {
    location: {
      city: city ?? undefined,
      country: country ?? undefined,
      region: region ?? undefined,
      countries,
      source,
    },
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
