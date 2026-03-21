import type { ResolvedPlace } from "@/lib/search/resolve-place"

/** Subset of submit payload `location` used to build a geocode query. */
export type SubmitLocationPayload = {
  name?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postcode?: string
  /** Canonical fields from verify-then-select (Mapbox wire); used when server retrieve fails. */
  parentCity?: string | null
  lat?: number
  lng?: number
  formattedAddress?: string | null
  mapboxPlaceId?: string
} | undefined

/** Fields written to `Event` from place resolution (plus existing venue/address strings). */
export type PersistedSubmitLocation = {
  city: string
  country: string
  region: string | null
  parentCity: string | null
  lat: number | null
  lng: number | null
  formattedAddress: string | null
}

/**
 * Resolution query string for submit:
 * - Prefer full `address` when non-empty (≥2 chars).
 * - Else join non-empty `city` (excluding placeholder "Unknown"), `state`, `country`.
 */
export function buildSubmitPlaceResolveInput(location: SubmitLocationPayload): string | null {
  if (!location) return null

  const addr = location.address?.trim()
  if (addr && addr.length >= 2) return addr

  const parts: string[] = []
  const city = location.city?.trim()
  if (city && city.toLowerCase() !== "unknown") parts.push(city)
  const state = location.state?.trim()
  if (state) parts.push(state)
  const country = location.country?.trim()
  if (country) parts.push(country)

  if (parts.length === 0) return null
  return parts.join(", ")
}

/**
 * Merge resolver output with form fallbacks. When `resolved` is null, keeps submit defaults
 * (including user `state` as `region` when present).
 */
/**
 * When the client submitted a verified Mapbox id but server retrieve failed, persist structured
 * fields from the payload only (no forward-geocode from free-text address).
 */
export function mergeClientVerifiedLocation(
  location: NonNullable<SubmitLocationPayload>,
): PersistedSubmitLocation {
  return {
    city: location.city?.trim() || "Unknown",
    country: location.country?.trim() || "Australia",
    region: location.state?.trim() || null,
    parentCity: location.parentCity?.trim() || null,
    lat:
      typeof location.lat === "number" && Number.isFinite(location.lat) ? location.lat : null,
    lng:
      typeof location.lng === "number" && Number.isFinite(location.lng) ? location.lng : null,
    formattedAddress: location.formattedAddress?.trim() || null,
  }
}

export function mergeSubmitLocationAfterResolve(args: {
  resolved: ResolvedPlace | null
  fallbackCity: string
  fallbackCountry: string
  fallbackState: string | null
}): PersistedSubmitLocation {
  const { resolved, fallbackCity, fallbackCountry, fallbackState } = args

  if (!resolved) {
    return {
      city: fallbackCity,
      country: fallbackCountry,
      region: fallbackState,
      parentCity: null,
      lat: null,
      lng: null,
      formattedAddress: null,
    }
  }

  return {
    city: resolved.city,
    country: resolved.country,
    region: resolved.region ?? fallbackState ?? null,
    parentCity: resolved.parentCity ?? null,
    lat: resolved.lat ?? null,
    lng: resolved.lng ?? null,
    formattedAddress: resolved.formattedAddress ?? null,
  }
}
