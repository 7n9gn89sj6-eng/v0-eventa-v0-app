export interface GeocodingResult {
  address: string
  lat: number
  lng: number
  venueName?: string
}

export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  const token = process.env.MAPBOX_TOKEN

  if (!token) {
    console.warn("Mapbox token not configured")
    return null
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`,
    )

    if (!response.ok) {
      throw new Error("Geocoding failed")
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
  } catch (error) {
    console.error("Geocoding error:", error)
    return null
  }
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
