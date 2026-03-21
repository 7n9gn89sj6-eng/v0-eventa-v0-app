import { describe, expect, it } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { microLocationForWebSearch } from "@/lib/search/micro-location-for-web"

describe("microLocationForWebSearch", () => {
  it("returns raw when placeEvidence is explicit", () => {
    const intent = parseSearchIntent("art exhibitions in Patra")
    expect(intent.placeEvidence).toBe("explicit")
    expect(microLocationForWebSearch(intent)).toBeTruthy()
    expect(microLocationForWebSearch(intent)?.toLowerCase()).toContain("patra")
  })

  it("returns null when placeEvidence is implicit even if place.raw is set", () => {
    const intent = parseSearchIntent("Brisbane comedy")
    expect(intent.placeEvidence).toBe("implicit")
    expect(intent.place?.city).toBe("Brisbane")
    expect(microLocationForWebSearch(intent)).toBeNull()
  })

  it("selected-scope scenario: Melbourne URL + Brisbane comedy — no micro token for web", () => {
    const intent = parseSearchIntent("Brisbane comedy")
    expect(microLocationForWebSearch(intent)).toBeNull()
  })

  it("explicit in Patra keeps micro raw for web shaping", () => {
    const intent = parseSearchIntent("markets in Patra")
    expect(intent.placeEvidence).toBe("explicit")
    const micro = microLocationForWebSearch(intent)
    expect(micro).toBeTruthy()
    expect(micro?.toLowerCase()).toMatch(/patra/)
  })
})
