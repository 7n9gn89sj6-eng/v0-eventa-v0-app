/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { MapboxFeature } from "@/lib/geocoding"
import { GET as suggestGet } from "@/app/api/places/suggest/route"
import { GET as resolveGet, POST as resolvePost } from "@/app/api/places/resolve/route"
import { mapMapboxFeatureToSelectedPlace } from "@/lib/places/mapbox-feature-to-wire"
import { mapFeaturesToSuggestions } from "@/lib/places/place-api-mapbox"

const forwardMock = vi.hoisted(() => vi.fn())
const retrieveMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/places/mapbox-places-fetch", () => ({
  mapboxPlacesForwardSuggest: forwardMock,
  mapboxPlacesRetrieveById: retrieveMock,
}))

const brunswickLocality: MapboxFeature = {
  id: "locality.brunswick",
  type: "Feature",
  place_type: ["locality"],
  text: "Brunswick",
  place_name: "Brunswick, Melbourne, Victoria, Australia",
  center: [144.96, -37.77],
  context: [
    { id: "place.1", text: "Melbourne" },
    { id: "region.2", text: "Victoria" },
    { id: "country.3", text: "Australia" },
  ],
}

describe("mapMapboxFeatureToSelectedPlace", () => {
  it("maps Brunswick, Victoria, Australia with locality, parent city, region, coords", () => {
    const wire = mapMapboxFeatureToSelectedPlace(brunswickLocality)
    expect(wire).toEqual({
      provider: "mapbox",
      placeId: "locality.brunswick",
      formattedAddress: "Brunswick, Melbourne, Victoria, Australia",
      city: "Brunswick",
      country: "Australia",
      region: "Victoria",
      parentCity: "Melbourne",
      lat: -37.77,
      lng: 144.96,
      venueName: null,
      postcode: null,
    })
  })

  it("uses place_name tail for country when context omits country", () => {
    const feature: MapboxFeature = {
      id: "place.syd",
      type: "Feature",
      place_type: ["place"],
      text: "Sydney",
      place_name: "Sydney, New South Wales, Australia",
      center: [151.2, -33.86],
      context: [{ id: "region.1", text: "New South Wales" }],
    }
    const wire = mapMapboxFeatureToSelectedPlace(feature)
    expect(wire.country).toBe("Australia")
    expect(wire.city).toBe("Sydney")
    expect(wire.lat).toBe(-33.86)
    expect(wire.lng).toBe(151.2)
  })

  it("returns null lat/lng when center is not finite", () => {
    const feature: MapboxFeature = {
      id: "place.x",
      type: "Feature",
      place_type: ["place"],
      text: "Nowhere",
      place_name: "Nowhere, Australia",
      center: [Number.NaN, Number.NaN],
      context: [{ id: "country.1", text: "Australia" }],
    }
    const wire = mapMapboxFeatureToSelectedPlace(feature)
    expect(wire.lat).toBeNull()
    expect(wire.lng).toBeNull()
  })

  it("trims strings and uses null for optional empty fields", () => {
    const feature: MapboxFeature = {
      id: "  place.trim  ",
      type: "Feature",
      place_type: ["place"],
      text: "  Melbourne  ",
      place_name: "  Melbourne, Australia  ",
      center: [144.96, -37.81],
      context: [{ id: "country.1", text: "  Australia  " }],
    }
    const wire = mapMapboxFeatureToSelectedPlace(feature)
    expect(wire.placeId).toBe("place.trim")
    expect(wire.city).toBe("Melbourne")
    expect(wire.country).toBe("Australia")
    expect(wire.region).toBeNull()
    expect(wire.parentCity).toBeNull()
    expect(wire.venueName).toBeNull()
  })

  it("weak address: no city from street text; no fake country from single-segment place_name", () => {
    const feature: MapboxFeature = {
      id: "address.nicholson",
      type: "Feature",
      place_type: ["address"],
      text: "Nicholson Street",
      place_name: "Nicholson Street",
      center: [144.98, -37.78],
      context: [],
    }
    const wire = mapMapboxFeatureToSelectedPlace(feature)
    expect(wire.city).toBe("")
    expect(wire.country).toBe("")
    expect(wire.formattedAddress).toBe("Nicholson Street")
    expect(wire.lat).toBe(-37.78)
    expect(wire.lng).toBe(144.98)
    expect(wire.postcode).toBeNull()
  })

  it("address with locality in context: city from locality; country from known place_name tail", () => {
    const feature: MapboxFeature = {
      id: "address.railway",
      type: "Feature",
      place_type: ["address"],
      text: "800 Nicholson Street",
      place_name: "800 Nicholson Street, North Fitzroy, Victoria, Australia",
      center: [144.98, -37.78],
      context: [
        { id: "locality.1", text: "North Fitzroy" },
        { id: "region.2", text: "Victoria" },
      ],
    }
    const wire = mapMapboxFeatureToSelectedPlace(feature)
    expect(wire.city).toBe("North Fitzroy")
    expect(wire.country).toBe("Australia")
    expect(wire.region).toBe("Victoria")
  })

  it("maps postcode from Mapbox postcode context", () => {
    const feature: MapboxFeature = {
      id: "address.withpc",
      type: "Feature",
      place_type: ["address"],
      text: "1 Smith St",
      place_name: "1 Smith St, Fitzroy North Victoria 3068, Australia",
      center: [144.98, -37.78],
      context: [
        { id: "locality.1", text: "Fitzroy North" },
        { id: "postcode.2", text: "3068" },
        { id: "region.3", text: "Victoria" },
        { id: "country.4", text: "Australia" },
      ],
    }
    const wire = mapMapboxFeatureToSelectedPlace(feature)
    expect(wire.postcode).toBe("3068")
    expect(wire.city).toBe("Fitzroy North")
  })

  it("does not use unknown place_name tail as country", () => {
    const feature: MapboxFeature = {
      id: "address.foo",
      type: "Feature",
      place_type: ["address"],
      text: "Main Road",
      place_name: "Main Road, Fauxlandia",
      center: [0, 0],
      context: [{ id: "locality.1", text: "Somewhere" }],
    }
    const wire = mapMapboxFeatureToSelectedPlace(feature)
    expect(wire.city).toBe("Somewhere")
    expect(wire.country).toBe("")
  })
})

describe("mapFeaturesToSuggestions", () => {
  it("returns structured suggestion rows with id, label, primary, city, country, region, lat, lng", () => {
    const rows = mapFeaturesToSuggestions([brunswickLocality])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: "locality.brunswick",
      label: "Brunswick, Melbourne, Victoria, Australia",
      primary: "Brunswick",
      city: "Brunswick",
      country: "Australia",
      region: "Victoria",
      lat: -37.77,
      lng: 144.96,
    })
  })
})

describe("GET /api/places/suggest", () => {
  beforeEach(() => {
    forwardMock.mockReset()
    retrieveMock.mockReset()
  })

  it("returns structured suggestions from Mapbox features", async () => {
    forwardMock.mockResolvedValueOnce([
      {
        id: "place.mel",
        type: "Feature",
        place_type: ["place"],
        text: "Melbourne",
        place_name: "Melbourne, Victoria, Australia",
        center: [144.96, -37.81],
        context: [
          { id: "region.1", text: "Victoria" },
          { id: "country.2", text: "Australia" },
        ],
      },
    ])
    const req = new NextRequest("http://localhost/api/places/suggest?q=Mel")
    const res = await suggestGet(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { suggestions: unknown[] }
    expect(body.suggestions).toHaveLength(1)
    expect(body.suggestions[0]).toMatchObject({
      id: "place.mel",
      city: "Melbourne",
      country: "Australia",
      region: "Victoria",
    })
  })

  it("returns an empty list when the forward layer yields no features", async () => {
    forwardMock.mockResolvedValueOnce([])
    const req = new NextRequest("http://localhost/api/places/suggest?q=ab")
    const res = await suggestGet(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { suggestions: unknown[] }
    expect(body.suggestions).toEqual([])
  })
})

describe("/api/places/resolve", () => {
  beforeEach(() => {
    forwardMock.mockReset()
    retrieveMock.mockReset()
  })

  it("GET returns SelectedPlaceWire when retrieve succeeds", async () => {
    retrieveMock.mockResolvedValueOnce(brunswickLocality)
    const req = new NextRequest("http://localhost/api/places/resolve?id=locality.brunswick")
    const res = await resolveGet(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { place: ReturnType<typeof mapMapboxFeatureToSelectedPlace> }
    expect(body.place.city).toBe("Brunswick")
    expect(body.place.country).toBe("Australia")
    expect(body.place.formattedAddress).toContain("Brunswick")
  })

  it("GET returns 404 with place null when retrieve fails", async () => {
    retrieveMock.mockResolvedValueOnce(null)
    const req = new NextRequest("http://localhost/api/places/resolve?id=missing")
    const res = await resolveGet(req)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { place: null }
    expect(body.place).toBeNull()
  })

  it("GET succeeds when city/country are empty but core address + coords exist", async () => {
    retrieveMock.mockResolvedValueOnce({
      id: "address.weak",
      type: "Feature",
      place_type: ["address"],
      text: "Nicholson Street",
      place_name: "Nicholson Street",
      center: [144.98, -37.78],
      context: [],
    })
    const req = new NextRequest("http://localhost/api/places/resolve?id=address.weak")
    const res = await resolveGet(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { place: { city: string; country: string } }
    expect(body.place.city).toBe("")
    expect(body.place.country).toBe("")
  })

  it("POST feature payload resolves without retrieve", async () => {
    const req = new NextRequest("http://localhost/api/places/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: brunswickLocality }),
    })
    const res = await resolvePost(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { place: { city: string } }
    expect(body.place.city).toBe("Brunswick")
  })
})
