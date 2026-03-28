import type { MapboxFeature } from "@/lib/geocoding"
import { mapMapboxFeatureToSelectedPlace } from "@/lib/places/mapbox-feature-to-wire"
import { suggestKindLabel } from "@/lib/places/mapbox-suggest-helpers"

/** Suggestion row returned by GET /api/places/suggest (includes legacy primary for list UI). */
export function mapFeaturesToSuggestions(features: MapboxFeature[]) {
  return features.map((f) => {
    const wire = mapMapboxFeatureToSelectedPlace(f)
    const placeName = (f.place_name?.trim() || wire.formattedAddress).trim()
    const mapboxText = f.text?.trim() || ""
    const pt0 = f.place_type?.[0]
    const kind = suggestKindLabel(pt0)
    // Bold line: full Mapbox line (easier to tell "23 X St, …" vs "X Street" than short text alone).
    const primary = placeName || mapboxText || wire.city
    const label =
      mapboxText && mapboxText.toLowerCase() !== placeName.toLowerCase()
        ? `${kind} · Highlight: ${mapboxText}`
        : kind

    return {
      id: f.id,
      label,
      primary,
      city: wire.city,
      country: wire.country,
      region: wire.region ?? null,
      postcode: wire.postcode ?? null,
      lat: wire.lat ?? null,
      lng: wire.lng ?? null,
    }
  })
}
