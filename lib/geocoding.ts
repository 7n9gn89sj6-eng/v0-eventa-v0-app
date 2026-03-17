export interface GeocodingResult {
  address: string
  lat: number
  lng: number
  venueName?: string
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
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
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
      }
    )
    if (!response.ok) return null
    const data: NominatimSearchItem[] = await response.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const item = data[0]
    const lat = parseFloat(item.lat)
    const lng = parseFloat(item.lon)
    if (isNaN(lat) || isNaN(lng)) return null
    const city =
      item.address?.city ??
      item.address?.town ??
      item.address?.village ??
      item.address?.municipality ??
      item.address?.county ??
      item.display_name.split(",")[0]?.trim() ??
      item.display_name
    return {
      address: item.display_name,
      lat,
      lng,
      venueName: city,
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
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`
  )

  if (!response.ok) {
    console.error("[geocoding] Mapbox API error:", response.status, await response.text())
    throw new Error("Geocoding service request failed")
  }

  const data = await response.json()

  if (data.features && data.features.length > 0) {
    const feature = data.features[0]
    return {
      address: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
      venueName: feature.text,
    }
  }

  return null
}

interface NominatimResponse {
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
  }
  error?: string
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
    const response = await fetch(
      `/api/geocode/reverse?lat=${lat}&lng=${lng}`,
    )

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
