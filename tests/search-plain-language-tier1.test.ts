import { describe, it, expect } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import {
  normalizeSearchUtterance,
  stripTextSearchStopwords,
  stripTrailingAustralianStateTokens,
} from "@/lib/search/normalize-search-utterance"
import { getExpandedTermGroups } from "@/lib/search/search-taxonomy"

describe("Tier 1 plain-language search", () => {
  it("normalizeSearchUtterance strips leading search / instruction phrases", () => {
    expect(normalizeSearchUtterance("search music near me")).toBe("music near me")
    expect(normalizeSearchUtterance("please find markets today")).toBe("markets today")
    expect(normalizeSearchUtterance("show me comedy")).toBe("comedy")
  })

  it("stripTrailingAustralianStateTokens narrows Brunswick Victoria to Brunswick", () => {
    expect(stripTrailingAustralianStateTokens("Brunswick Victoria")).toBe("Brunswick")
    expect(stripTrailingAustralianStateTokens("Brunswick")).toBe("Brunswick")
  })

  it('"search music this weekend in Brunswick Victoria Australia" → Brunswick + Australia + music', () => {
    const intent = parseSearchIntent("search music this weekend in Brunswick Victoria Australia")
    expect(intent.place?.city).toBe("Brunswick")
    expect(intent.place?.country).toBe("Australia")
    expect(intent.interest).toContain("music")
    expect(intent.time?.label).toBe("weekend")
  })

  it('"music in Berlin" remains Berlin (no AU state strip)', () => {
    const intent = parseSearchIntent("music in Berlin")
    expect(intent.place?.city).toMatch(/Berlin/i)
    expect(intent.place?.country).toBe("Germany")
  })

  it('"markets in Brunswick" unchanged city', () => {
    const intent = parseSearchIntent("markets in Brunswick")
    expect(intent.place?.city).toBe("Brunswick")
    expect(intent.interest).toContain("markets")
  })

  it("stripTextSearchStopwords removes search so it is not a required term group", () => {
    const after = stripTextSearchStopwords("search music")
    expect(after).toBe("music")
    const groups = getExpandedTermGroups(after)
    const flat = groups.flat().map((t) => t.toLowerCase())
    expect(flat.some((t) => t === "search")).toBe(false)
  })

  it("stripTextSearchStopwords removes event/events glue (city-only queries after city strip)", () => {
    expect(stripTextSearchStopwords("events")).toBe("")
    expect(stripTextSearchStopwords("event")).toBe("")
  })
})
