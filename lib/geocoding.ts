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
 * Uses OpenStreetMap Nominatim reverse geocoding API
 *
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns City name or null if lookup fails
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // Nominatim terms require User-Agent header
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Eventa-App/1.0",
        },
      },
    )

    if (!response.ok) {
      console.error("[v0] Nominatim API error:", response.status)
      return null
    }

    const data: NominatimResponse = await response.json()

    if (data.error) {
      console.error("[v0] Nominatim returned error:", data.error)
      return null
    }

    // Try to extract city name from address hierarchy
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      data.address?.county

    return city || null
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
