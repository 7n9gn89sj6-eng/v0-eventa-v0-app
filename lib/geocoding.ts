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
