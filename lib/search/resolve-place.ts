import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"
import type { GeocodingPlaceType, GeocodingResult } from "@/lib/geocoding"
import { geocodeAddress, GeocodingConfigError } from "@/lib/geocoding"

export type ResolvedPlace = {
  city: string
  country: string
  region?: string
  parentCity?: string
  lat?: number
  lng?: number
  formattedAddress?: string
}

function trimNonEmpty(s: string | undefined | null): string | undefined {
  const t = s?.trim()
  return t && t.length > 0 ? t : undefined
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Legacy parsing when structured fields are incomplete (comma-separated place_name). */
function parseCommaFallback(address: string): {
  city: string
  country: string
  region?: string
  parentCity?: string
} | null {
  const parts = address.split(", ").map((s) => s.trim()).filter(Boolean)
  const city = parts[0] ?? address.trim()
  const country = parts.length > 1 ? parts[parts.length - 1] : undefined
  if (!city || !country) return null
  const region = parts.length >= 3 ? parts[parts.length - 2] : undefined
  const parentCity = parts.length >= 4 ? parts[1] : undefined
  return { city, country, region, parentCity }
}

const WEAK_PLACE_TYPES: GeocodingPlaceType[] = ["country", "region"]

/**
 * Maps a geocoding result to ResolvedPlace. Conservative: null when the hit is too coarse
 * or city/country cannot be determined reliably.
 */
export function mapGeocodingResultToResolvedPlace(result: GeocodingResult): ResolvedPlace | null {
  if (result.placeType && WEAK_PLACE_TYPES.includes(result.placeType)) {
    return null
  }

  let city = trimNonEmpty(result.locality)
  let country = trimNonEmpty(result.country)
  let region = trimNonEmpty(result.region)
  let parentCity = trimNonEmpty(result.parentCity)

  if (!city || !country) {
    const fb = parseCommaFallback(result.address)
    if (!fb) return null
    city = city ?? fb.city
    country = country ?? fb.country
    region = region ?? fb.region
    parentCity = parentCity ?? fb.parentCity
  }

  if (!city || !country) return null

  if (parentCity && sameName(parentCity, city)) {
    parentCity = undefined
  }

  return {
    city,
    country,
    region,
    parentCity,
    lat: result.lat,
    lng: result.lng,
    formattedAddress: result.address,
  }
}

/**
 * Forward-geocode a user place string to structured fields (server-side; uses geocodeAddress / Mapbox or Nominatim).
 * Returns null when geocoding fails or city/country cannot be derived — callers keep regex-extracted place.
 */
export async function resolvePlace(input: string): Promise<ResolvedPlace | null> {
  const q = String(input || "").trim()
  if (q.length < 2) return null

  try {
    const result = await geocodeAddress(q)
    if (!result) return null
    return mapGeocodingResultToResolvedPlace(result)
  } catch (e) {
    if (e instanceof GeocodingConfigError) {
      console.warn("[place.resolve] Geocoding unavailable:", e.message)
      return null
    }
    console.warn("[place.resolve] Geocoding error:", e)
    return null
  }
}

/** String passed to forward geocode; prefers `raw`, else "city, country". */
export function buildPlaceResolveInput(place: NonNullable<SearchIntent["place"]>): string | null {
  if (place.raw?.trim()) return place.raw.trim()
  const parts = [place.city, place.country].map((x) => x?.trim()).filter(Boolean) as string[]
  return parts.length ? parts.join(", ") : null
}

export function shouldAttemptPlaceResolve(intent: SearchIntent, placeInput: string | null): boolean {
  if (!placeInput || !intent.place) return false
  if (intent.scope === "global") return false
  if (intent.scope === "region" && intent.place.region && !intent.place.city && !intent.place.raw) return false
  return true
}

/**
 * Only replace parser city when geocoder returns the same locality or a clear suffix (e.g. "Brunswick East").
 * Rejects unrelated prefixes like "Municipality of Athens" when the user said "Athens".
 */
export function isResolvedPlaceCompatibleWithParsed(
  parsed: NonNullable<SearchIntent["place"]>,
  resolved: ResolvedPlace,
): boolean {
  const pc = parsed.city?.toLowerCase().trim()
  if (!pc) return true
  const rc = resolved.city.toLowerCase().trim()
  if (rc === pc) return true
  if (rc.startsWith(`${pc} `) || rc.startsWith(`${pc},`)) return true
  return false
}
