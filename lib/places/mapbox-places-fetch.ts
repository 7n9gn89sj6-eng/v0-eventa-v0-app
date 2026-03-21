import type { MapboxFeature } from "@/lib/geocoding"

/** Places API: prefers MAPBOX_ACCESS_TOKEN, then existing MAPBOX_TOKEN. */
export function getMapboxAccessTokenForPlaces(): string | undefined {
  const a = process.env.MAPBOX_ACCESS_TOKEN?.trim()
  const b = process.env.MAPBOX_TOKEN?.trim()
  return a || b || undefined
}

/**
 * Forward geocode for suggestions. Never throws; returns [] on missing config, network, or HTTP errors.
 */
export async function mapboxPlacesForwardSuggest(
  query: string,
  opts?: { limit?: number },
): Promise<MapboxFeature[]> {
  const token = getMapboxAccessTokenForPlaces()
  if (!token) return []

  const q = query.trim()
  if (q.length < 2) return []

  const limit = Math.min(Math.max(opts?.limit ?? 6, 1), 10)
  const path = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
  const url = new URL(path)
  url.searchParams.set("access_token", token)
  url.searchParams.set("autocomplete", "true")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("types", "address,poi,place,locality,neighborhood")

  try {
    const response = await fetch(url.toString())
    if (!response.ok) {
      console.warn("[places] Mapbox suggest HTTP", response.status)
      return []
    }
    const data = (await response.json()) as { features?: unknown }
    if (!data.features || !Array.isArray(data.features)) return []
    return data.features as MapboxFeature[]
  } catch (e) {
    console.warn("[places] Mapbox suggest failed", e)
    return []
  }
}

/**
 * Retrieve one feature by permanent Mapbox id. Never throws.
 */
export async function mapboxPlacesRetrieveById(mapboxId: string): Promise<MapboxFeature | null> {
  const token = getMapboxAccessTokenForPlaces()
  if (!token) return null

  const id = mapboxId.trim()
  if (!id.length) return null

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(id)}.json?access_token=${encodeURIComponent(token)}`
    const response = await fetch(url)
    if (!response.ok) {
      console.warn("[places] Mapbox retrieve HTTP", response.status)
      return null
    }
    const data = (await response.json()) as { features?: unknown }
    if (!data.features || !Array.isArray(data.features) || data.features.length === 0) return null
    return data.features[0] as MapboxFeature
  } catch (e) {
    console.warn("[places] Mapbox retrieve failed", e)
    return null
  }
}
