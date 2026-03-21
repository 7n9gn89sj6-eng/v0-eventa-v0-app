import { describe, it, expect } from "vitest"
import { mapFeaturesToSuggestions } from "@/lib/places/place-api-mapbox"
import type { MapboxFeature } from "@/lib/geocoding"

describe("mapFeaturesToSuggestions", () => {
  it("maps Mapbox features to stable suggestion rows", () => {
    const features: MapboxFeature[] = [
      {
        id: "place.123",
        type: "Feature",
        place_type: ["place"],
        text: "Melbourne",
        place_name: "Melbourne, Victoria, Australia",
        center: [144.96, -37.81],
        context: [],
      },
    ]
    expect(mapFeaturesToSuggestions(features)).toEqual([
      {
        id: "place.123",
        label: "Melbourne, Victoria, Australia",
        primary: "Melbourne",
        city: "Melbourne",
        country: "Australia",
        region: null,
        lat: -37.81,
        lng: 144.96,
      },
    ])
  })
})
