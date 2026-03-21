/**
 * Normalized category for the geocoded feature (Mapbox place_type[0] or Nominatim-derived).
 * Used for conservative downstream resolution (e.g. skip region/country-only hits as "city").
 */
export type GeocodingPlaceType =
  | "country"
  | "region"
  | "postcode"
  | "district"
  | "place"
  | "locality"
  | "neighborhood"
  | "address"
  | "poi"
  | "unknown"

export interface GeocodingResult {
  /** Provider formatted label (Mapbox place_name / Nominatim display_name) */
  address: string
  lat: number
  lng: number
  /** Short primary label from the provider (e.g. Mapbox `text`) */
  venueName?: string
  /** City / suburb / town — smallest useful locality when derivable */
  locality?: string
  /** State / province / admin area */
  region?: string
  /** Country as a display name */
  country?: string
  /** Larger city when `locality` is a suburb or sub-area (metro candidate) */
  parentCity?: string
  placeType?: GeocodingPlaceType
}

/** Thrown when geocoding cannot run due to missing config (e.g. MAPBOX_TOKEN). */
export class GeocodingConfigError extends Error {
  readonly code = "GEOCODING_CONFIG"
  constructor(message: string) {
    super(message)
    this.name = "GeocodingConfigError"
  }
}

/** Nominatim search result item (forward geocode). */
interface NominatimSearchItem {
  lat: string
  lon: string
  display_name: string
  address?: {
    suburb?: string
    neighbourhood?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
  }
}

function norm(s: string | undefined | null): string | undefined {
  const t = s?.trim()
  return t && t.length > 0 ? t : undefined
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Derive locality, parent city, region, country from Nominatim address object.
 * Prefers suburb/neighbourhood over city so AU suburbs stay locality-first.
 */
function nominatimStructuredFromAddress(addr: NominatimSearchItem["address"]): Pick<
  GeocodingResult,
  "locality" | "parentCity" | "region" | "country" | "placeType"
> {
  if (!addr) {
    return { placeType: "unknown" }
  }

  const country = norm(addr.country)
  const region = norm(addr.state)
  const suburb = norm(addr.suburb) ?? norm(addr.neighbourhood)
  const town = norm(addr.town) ?? norm(addr.village) ?? norm(addr.municipality)
  const cityField = norm(addr.city)
  const county = norm(addr.county)

  let locality: string | undefined
  let parentCity: string | undefined
  let placeType: GeocodingPlaceType = "unknown"

  if (suburb) {
    locality = suburb
    placeType = "locality"
    if (cityField && !sameName(suburb, cityField)) parentCity = cityField
  } else if (town) {
    locality = town
    placeType = "place"
    if (cityField && !sameName(town, cityField)) parentCity = cityField
  } else if (cityField) {
    locality = cityField
    placeType = "place"
  } else if (county) {
    locality = county
    placeType = "district"
  }

  return {
    locality,
    parentCity,
    region,
    country,
    placeType,
  }
}

/** Mapbox forward geocode feature (subset). */
interface MapboxContext {
  id: string
  text: string
  short_code?: string
}

interface MapboxFeature {
  id: string
  type: string
  place_type: string[]
  relevance?: number
  text: string
  place_name: string
  center: [number, number]
  context?: MapboxContext[]
}

function mapboxContextByPrefix(context: MapboxContext[] | undefined, prefix: string): MapboxContext | undefined {
  return context?.find((c) => c.id.startsWith(`${prefix}.`))
}

function mapboxStructuredFromFeature(feature: MapboxFeature): Pick<
  GeocodingResult,
  "locality" | "parentCity" | "region" | "country" | "placeType"
> {
  const primary = feature.place_type?.[0] ?? "unknown"
  const placeType = (["country", "region", "postcode", "district", "place", "locality", "neighborhood", "address", "poi"].includes(
    primary,
  )
    ? primary
    : "unknown") as GeocodingPlaceType

  const ctx = feature.context ?? []
  const country = mapboxContextByPrefix(ctx, "country")?.text
  const region = mapboxContextByPrefix(ctx, "region")?.text
  const place = mapboxContextByPrefix(ctx, "place")?.text
  const locality = mapboxContextByPrefix(ctx, "locality")?.text
  const neighborhood = mapboxContextByPrefix(ctx, "neighborhood")?.text

  let outLocality: string | undefined
  let outParent: string | undefined

  if (primary === "locality" || primary === "neighborhood") {
    outLocality = norm(feature.text)
    outParent = norm(place)
    if (outLocality && outParent && sameName(outLocality, outParent)) outParent = undefined
  } else if (primary === "place") {
    outLocality = norm(feature.text)
    outParent = undefined
  } else if (primary === "district") {
    outLocality = norm(feature.text)
    outParent = norm(place)
    if (outLocality && outParent && sameName(outLocality, outParent)) outParent = undefined
  } else if (primary === "address") {
    outLocality = norm(locality) ?? norm(neighborhood) ?? norm(place)
    const p = norm(place)
    if ((locality || neighborhood) && p && outLocality && !sameName(outLocality, p)) {
      outParent = p
    } else {
      outParent = undefined
    }
  } else if (primary === "poi") {
    const sub = norm(locality) ?? norm(neighborhood)
    const plc = norm(place)
    if (sub) {
      outLocality = sub
      outParent = plc && !sameName(sub, plc) ? plc : undefined
    } else if (plc) {
      outLocality = plc
      outParent = undefined
    } else {
      outLocality = norm(feature.text)
      outParent = undefined
    }
  } else if (primary === "postcode") {
    outLocality = norm(place) ?? norm(locality) ?? norm(feature.text)
    outParent = undefined
  } else if (primary === "region" || primary === "country") {
    outLocality = norm(feature.text)
    outParent = undefined
  } else {
    outLocality = norm(feature.text)
    outParent = norm(place)
    if (outLocality && outParent && sameName(outLocality, outParent)) outParent = undefined
  }

  return {
    locality: outLocality,
    parentCity: outParent,
    region: norm(region),
    country: norm(country),
    placeType,
  }
}

/**
 * Forward geocode using Nominatim (no API key). Use as fallback when Mapbox is unavailable.
 * Respects Nominatim usage policy (1 req/s, User-Agent).
 */
async function nominatimForwardSearch(query: string): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Eventa-App/1.0 (https://eventa.app)",
          Accept: "application/json",
        },
      },
    )
    if (!response.ok) return null
    const data: NominatimSearchItem[] = await response.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const item = data[0]
    const lat = parseFloat(item.lat)
    const lng = parseFloat(item.lon)
    if (isNaN(lat) || isNaN(lng)) return null

    const structured = nominatimStructuredFromAddress(item.address)
    const locality =
      structured.locality ??
      item.display_name.split(",")[0]?.trim() ??
      item.display_name

    return {
      address: item.display_name,
      lat,
      lng,
      venueName: locality,
      locality: structured.locality ?? locality,
      region: structured.region,
      country: structured.country,
      parentCity: structured.parentCity,
      placeType: structured.placeType !== "unknown" ? structured.placeType : locality ? "place" : "unknown",
    }
  } catch {
    return null
  }
}

/**
 * Forward geocode: query (city/address) → lat, lng, address.
 * Uses Mapbox when MAPBOX_TOKEN is set; falls back to Nominatim when token is missing.
 * - Returns null only when the provider returns no results (not when config is missing).
 * - Throws GeocodingConfigError when Mapbox is not configured and Nominatim fallback fails.
 * - Throws on Mapbox API/network errors so callers can return 500.
 */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  const token = process.env.MAPBOX_TOKEN

  if (!token) {
    console.warn("[geocoding] Mapbox token not configured; trying Nominatim fallback")
    const fallback = await nominatimForwardSearch(query)
    if (fallback) return fallback
    throw new GeocodingConfigError("Geocoding service is not configured (MAPBOX_TOKEN missing and fallback unavailable).")
  }

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`,
  )

  if (!response.ok) {
    console.error("[geocoding] Mapbox API error:", response.status, await response.text())
    throw new Error("Geocoding service request failed")
  }

  const data = await response.json()

  if (data.features && data.features.length > 0) {
    const feature = data.features[0] as MapboxFeature
    const structured = mapboxStructuredFromFeature(feature)
    return {
      address: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
      venueName: feature.text,
      locality: structured.locality,
      region: structured.region,
      country: structured.country,
      parentCity: structured.parentCity,
      placeType: structured.placeType,
    }
  }

  return null
}

/**
 * Convert latitude/longitude coordinates to city name
 * Uses our server-side API route which proxies to Nominatim (to avoid CORS issues)
 *
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns City name or null if lookup fails
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // Use our server-side API route to avoid CORS issues
    const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)

    if (!response.ok) {
      console.error("[v0] Reverse geocoding API error:", response.status)
      return null
    }

    const data = await response.json()

    if (data.error) {
      console.error("[v0] Reverse geocoding returned error:", data.error)
      return null
    }

    return data.city || null
  } catch (error) {
    console.error("[v0] Reverse geocoding failed:", error)
    return null
  }
}

/**
 * Debounced version of reverseGeocode to respect Nominatim rate limits
 * (1 request per second)
 */
let lastGeocodeTime = 0
const GEOCODE_DEBOUNCE_MS = 1000

export async function reverseGeocodeDebounced(lat: number, lng: number): Promise<string | null> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastGeocodeTime

  // Wait if we're within the debounce window
  if (timeSinceLastRequest < GEOCODE_DEBOUNCE_MS) {
    await new Promise((resolve) => setTimeout(resolve, GEOCODE_DEBOUNCE_MS - timeSinceLastRequest))
  }

  lastGeocodeTime = Date.now()
  return reverseGeocode(lat, lng)
}
