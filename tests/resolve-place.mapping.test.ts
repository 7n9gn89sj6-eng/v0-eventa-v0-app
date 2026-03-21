import { describe, it, expect, vi, beforeEach } from "vitest"
import type { GeocodingResult } from "@/lib/geocoding"
import { GeocodingConfigError } from "@/lib/geocoding"
import {
  mapGeocodingResultToResolvedPlace,
  resolvePlace,
} from "@/lib/search/resolve-place"

vi.mock("@/lib/geocoding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geocoding")>()
  return {
    ...actual,
    geocodeAddress: vi.fn(),
  }
})

import { geocodeAddress } from "@/lib/geocoding"

const mockedGeocode = vi.mocked(geocodeAddress)

describe("mapGeocodingResultToResolvedPlace", () => {
  it("Brunswick Victoria Australia: locality-first city and parentCity when derivable", () => {
    const result: GeocodingResult = {
      address: "Brunswick, Melbourne, Victoria, Australia",
      lat: -37.7667,
      lng: 144.9667,
      locality: "Brunswick",
      region: "Victoria",
      country: "Australia",
      parentCity: "Melbourne",
      placeType: "locality",
    }
    const resolved = mapGeocodingResultToResolvedPlace(result)
    expect(resolved).not.toBeNull()
    expect(resolved!.city).toBe("Brunswick")
    expect(resolved!.parentCity).toBe("Melbourne")
    expect(resolved!.region).toBe("Victoria")
    expect(resolved!.country).toBe("Australia")
    expect(resolved!.lat).toBe(-37.7667)
    expect(resolved!.lng).toBe(144.9667)
    expect(resolved!.formattedAddress).toBe(result.address)
  })

  it("Berlin Germany: city is Berlin, no parentCity", () => {
    const result: GeocodingResult = {
      address: "Berlin, Germany",
      lat: 52.52,
      lng: 13.405,
      locality: "Berlin",
      region: "Berlin",
      country: "Germany",
      placeType: "place",
    }
    const resolved = mapGeocodingResultToResolvedPlace(result)
    expect(resolved).not.toBeNull()
    expect(resolved!.city).toBe("Berlin")
    expect(resolved!.country).toBe("Germany")
    expect(resolved!.parentCity).toBeUndefined()
  })

  it("POI markets in Brunswick: keeps Brunswick as city and Melbourne as parentCity", () => {
    const result: GeocodingResult = {
      address: "Queen Victoria Market, Brunswick, Victoria, Australia",
      lat: -37.8076,
      lng: 144.9568,
      venueName: "Queen Victoria Market",
      locality: "Brunswick",
      region: "Victoria",
      country: "Australia",
      parentCity: "Melbourne",
      placeType: "poi",
    }
    const resolved = mapGeocodingResultToResolvedPlace(result)
    expect(resolved).not.toBeNull()
    expect(resolved!.city).toBe("Brunswick")
    expect(resolved!.parentCity).toBe("Melbourne")
    expect(resolved!.country).toBe("Australia")
  })

  it("region-only structured hit returns null (conservative)", () => {
    const result: GeocodingResult = {
      address: "Victoria, Australia",
      lat: -36.9848,
      lng: 143.3906,
      locality: "Victoria",
      country: "Australia",
      placeType: "region",
    }
    expect(mapGeocodingResultToResolvedPlace(result)).toBeNull()
  })

  it("drops parentCity when equal to city", () => {
    const result: GeocodingResult = {
      address: "Melbourne, Victoria, Australia",
      lat: -37.81,
      lng: 144.96,
      locality: "Melbourne",
      parentCity: "Melbourne",
      country: "Australia",
      placeType: "place",
    }
    const resolved = mapGeocodingResultToResolvedPlace(result)
    expect(resolved).not.toBeNull()
    expect(resolved!.parentCity).toBeUndefined()
  })

  it("fills missing structured fields from comma address", () => {
    const result: GeocodingResult = {
      address: "Lyon, Auvergne-Rhône-Alpes, France",
      lat: 45.76,
      lng: 4.835,
      placeType: "unknown",
    }
    const resolved = mapGeocodingResultToResolvedPlace(result)
    expect(resolved).not.toBeNull()
    expect(resolved!.city).toBe("Lyon")
    expect(resolved!.country).toBe("France")
  })
})

describe("resolvePlace", () => {
  beforeEach(() => {
    mockedGeocode.mockReset()
  })

  it("returns null when geocodeAddress returns null", async () => {
    mockedGeocode.mockResolvedValue(null)
    await expect(resolvePlace("nowhere xyz")).resolves.toBeNull()
  })

  it("returns null on GeocodingConfigError (search continues with parsed place)", async () => {
    mockedGeocode.mockRejectedValue(new GeocodingConfigError("no token"))
    await expect(resolvePlace("Berlin")).resolves.toBeNull()
  })

  it("maps geocoder output through mapGeocodingResultToResolvedPlace", async () => {
    mockedGeocode.mockResolvedValue({
      address: "Brunswick, Melbourne, Victoria, Australia",
      lat: 1,
      lng: 2,
      locality: "Brunswick",
      country: "Australia",
      parentCity: "Melbourne",
      region: "Victoria",
      placeType: "locality",
    })
    const resolved = await resolvePlace("Brunswick Victoria Australia")
    expect(resolved?.city).toBe("Brunswick")
    expect(resolved?.parentCity).toBe("Melbourne")
  })
})
