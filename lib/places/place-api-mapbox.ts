import type { MapboxFeature } from "@/lib/geocoding"
import { mapMapboxFeatureToSelectedPlace } from "@/lib/places/mapbox-feature-to-wire"

/** Suggestion row returned by GET /api/places/suggest (includes legacy primary for list UI). */
export function mapFeaturesToSuggestions(features: MapboxFeature[]) {
  return features.map((f) => {
    const wire = mapMapboxFeatureToSelectedPlace(f)
    const primary = f.text?.trim() || wire.city
    return {
      id: f.id,
      label: f.place_name?.trim() || wire.formattedAddress,
      primary,
      city: wire.city,
      country: wire.country,
      region: wire.region ?? null,
      lat: wire.lat ?? null,
      lng: wire.lng ?? null,
    }
  })
}
