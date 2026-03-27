import type { MapboxFeature } from "@/lib/geocoding"
import { mapboxStructuredFromFeature } from "@/lib/geocoding"
import { mapboxCountryFromPlaceNameTailIfKnown } from "@/lib/places/mapbox-known-countries"
import type { SelectedPlaceWire } from "@/lib/places/selected-place"

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function trimOrEmpty(s: string | undefined | null): string {
  const t = s?.trim()
  return t && t.length > 0 ? t : ""
}

function trimOrNull(s: string | undefined | null): string | null {
  const t = s?.trim()
  return t && t.length > 0 ? t : null
}

function placeFromContext(feature: MapboxFeature): string | null {
  const ctx = feature.context ?? []
  const c = ctx.find((x) => x.id.startsWith("place."))
  return trimOrNull(c?.text)
}

/**
 * Normalize a Mapbox Geocoding feature into {@link SelectedPlaceWire}.
 * - city: locality + context place; for {@code address} features never use {@code feature.text} (street).
 * - country: Mapbox structured country only, or a {@code place_name} tail that matches a known country.
 * - parentCity follows structured rules; when locality exists and differs from context place, parent is place.
 */
export function mapMapboxFeatureToSelectedPlace(feature: MapboxFeature): SelectedPlaceWire {
  const structured = mapboxStructuredFromFeature(feature)
  const plc = placeFromContext(feature)
  const primaryType = feature.place_type?.[0]

  let city =
    primaryType === "address"
      ? trimOrEmpty(structured.locality) || trimOrEmpty(plc) || ""
      : trimOrEmpty(structured.locality) || trimOrEmpty(plc) || trimOrEmpty(feature.text) || ""

  let parentCity: string | null = trimOrNull(structured.parentCity)
  const loc = trimOrNull(structured.locality)
  const placeCtx = trimOrNull(plc)
  if (loc && placeCtx && !sameName(loc, placeCtx) && !parentCity) {
    parentCity = placeCtx
  }
  if (parentCity && city && sameName(parentCity, city)) {
    parentCity = null
  }

  let country =
    trimOrNull(structured.country) ?? trimOrNull(mapboxCountryFromPlaceNameTailIfKnown(feature.place_name))
  if (!country) country = ""

  const region = trimOrNull(structured.region)

  const formattedAddress =
    trimOrEmpty(feature.place_name) ||
    [city, region ?? undefined, country].filter(Boolean).join(", ") ||
    city

  let lat: number | null = null
  let lng: number | null = null
  if (Array.isArray(feature.center) && feature.center.length >= 2) {
    const lo = feature.center[0]
    const la = feature.center[1]
    if (typeof lo === "number" && typeof la === "number" && Number.isFinite(lo) && Number.isFinite(la)) {
      lng = lo
      lat = la
    }
  }

  const venueName = primaryType === "poi" ? trimOrNull(feature.text) : null

  const placeId = trimOrNull(feature.id)

  return {
    provider: "mapbox",
    placeId,
    formattedAddress,
    city,
    country,
    region,
    parentCity,
    lat,
    lng,
    venueName,
  }
}
