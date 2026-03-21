import { describe, it, expect } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { buildPlaceResolveInput } from "@/lib/search/resolve-place"

describe("buildPlaceResolveInput", () => {
  it("end-to-end: Music in Brunswick + AU bias → Brunswick, Australia", () => {
    const intent = parseSearchIntent("Music in Brunswick")
    expect(intent.place?.city).toBe("Brunswick")
    expect(intent.place?.country).toBeUndefined()
    expect(buildPlaceResolveInput(intent.place!, "Australia")).toBe("Brunswick, Australia")
  })

  it("end-to-end: explicit US in query → geocode string stays US even with AU bias", () => {
    const intent = parseSearchIntent("Music in Brunswick USA")
    expect(intent.place?.country).toBe("United States")
    expect(buildPlaceResolveInput(intent.place!, "Australia")).toMatch(/Brunswick,\s*United States/i)
  })

  it("appends bias country when query place has no country (Brunswick + Australia)", () => {
    expect(
      buildPlaceResolveInput(
        { city: "Brunswick", raw: "Brunswick" },
        "Australia",
      ),
    ).toBe("Brunswick, Australia")
  })

  it("keeps explicit query country over bias (Brunswick USA)", () => {
    expect(
      buildPlaceResolveInput(
        {
          city: "Brunswick",
          raw: "Brunswick",
          country: "United States",
        },
        "Australia",
      ),
    ).toBe("Brunswick, United States")
  })

  it("Berlin without bias stays locality-only (no regression)", () => {
    expect(
      buildPlaceResolveInput({ city: "Berlin", raw: "Berlin" }, undefined),
    ).toBe("Berlin")
    expect(buildPlaceResolveInput({ city: "Berlin", raw: "Berlin" }, null)).toBe("Berlin")
  })

  it("end-to-end: Music in Berlin uses known-city country (Germany), bias ignored", () => {
    const intent = parseSearchIntent("Music in Berlin")
    expect(intent.place?.country).toBe("Germany")
    expect(buildPlaceResolveInput(intent.place!, "Australia")).toBe("Berlin, Germany")
  })

  it("uses parsed country when only city is set (no raw)", () => {
    expect(
      buildPlaceResolveInput({ city: "Berlin", country: "Germany" }, "Australia"),
    ).toBe("Berlin, Germany")
  })

  it("returns null when no locality", () => {
    expect(buildPlaceResolveInput({ country: "Australia" }, "Australia")).toBeNull()
  })
})
