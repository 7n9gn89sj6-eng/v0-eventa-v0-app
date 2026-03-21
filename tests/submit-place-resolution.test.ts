import { describe, it, expect } from "vitest"
import {
  buildSubmitPlaceResolveInput,
  mergeSubmitLocationAfterResolve,
} from "@/lib/events/submit-place-resolution"

describe("buildSubmitPlaceResolveInput", () => {
  it("prefers full address when at least 2 characters", () => {
    expect(
      buildSubmitPlaceResolveInput({
        address: "  123 Sydney Rd, Brunswick VIC  ",
        city: "Melbourne",
        country: "Australia",
      }),
    ).toBe("123 Sydney Rd, Brunswick VIC")
  })

  it("builds city, state, country when address absent", () => {
    expect(
      buildSubmitPlaceResolveInput({
        city: "Brunswick",
        state: "Victoria",
        country: "Australia",
      }),
    ).toBe("Brunswick, Victoria, Australia")
  })

  it("Berlin: city and country only", () => {
    expect(
      buildSubmitPlaceResolveInput({
        city: "Berlin",
        country: "Germany",
      }),
    ).toBe("Berlin, Germany")
  })

  it("skips Unknown placeholder city but keeps state and country", () => {
    expect(
      buildSubmitPlaceResolveInput({
        city: "Unknown",
        state: "Victoria",
        country: "Australia",
      }),
    ).toBe("Victoria, Australia")
  })

  it("returns null when nothing usable", () => {
    expect(buildSubmitPlaceResolveInput(undefined)).toBeNull()
    expect(buildSubmitPlaceResolveInput({ city: "Unknown", country: "" })).toBeNull()
  })
})

describe("mergeSubmitLocationAfterResolve", () => {
  it("Brunswick resolves to locality, Australia, parent Melbourne when resolver returns them", () => {
    const persisted = mergeSubmitLocationAfterResolve({
      resolved: {
        city: "Brunswick",
        country: "Australia",
        region: "Victoria",
        parentCity: "Melbourne",
        lat: -37.77,
        lng: 144.97,
        formattedAddress: "Brunswick, Melbourne, Victoria, Australia",
      },
      fallbackCity: "Brunswick",
      fallbackCountry: "Australia",
      fallbackState: "Victoria",
    })
    expect(persisted.city).toBe("Brunswick")
    expect(persisted.country).toBe("Australia")
    expect(persisted.region).toBe("Victoria")
    expect(persisted.parentCity).toBe("Melbourne")
    expect(persisted.lat).toBe(-37.77)
    expect(persisted.lng).toBe(144.97)
    expect(persisted.formattedAddress).toBe("Brunswick, Melbourne, Victoria, Australia")
  })

  it("Berlin resolves without parentCity", () => {
    const persisted = mergeSubmitLocationAfterResolve({
      resolved: {
        city: "Berlin",
        country: "Germany",
        region: "Berlin",
        lat: 52.52,
        lng: 13.405,
        formattedAddress: "Berlin, Germany",
      },
      fallbackCity: "Berlin",
      fallbackCountry: "Germany",
      fallbackState: null,
    })
    expect(persisted.city).toBe("Berlin")
    expect(persisted.country).toBe("Germany")
    expect(persisted.parentCity).toBeNull()
  })

  it("resolvePlace failure (null): keeps fallbacks unchanged", () => {
    const persisted = mergeSubmitLocationAfterResolve({
      resolved: null,
      fallbackCity: "Unknown",
      fallbackCountry: "Australia",
      fallbackState: "NSW",
    })
    expect(persisted.city).toBe("Unknown")
    expect(persisted.country).toBe("Australia")
    expect(persisted.region).toBe("NSW")
    expect(persisted.parentCity).toBeNull()
    expect(persisted.lat).toBeNull()
    expect(persisted.lng).toBeNull()
    expect(persisted.formattedAddress).toBeNull()
  })

  it("uses fallback state as region when resolver omits region", () => {
    const persisted = mergeSubmitLocationAfterResolve({
      resolved: {
        city: "Yarra",
        country: "Australia",
      },
      fallbackCity: "Yarra",
      fallbackCountry: "Australia",
      fallbackState: "Victoria",
    })
    expect(persisted.region).toBe("Victoria")
  })
})
