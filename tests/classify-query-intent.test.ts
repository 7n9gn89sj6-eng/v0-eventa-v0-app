import { describe, expect, it } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import {
  classifyQueryIntent,
  hasNamedArtistPerformanceFraming,
  mapSearchIntentTypeToMode,
  type SearchIntentType,
} from "@/lib/search/classifyQueryIntent"

function expectShape(q: string, intentType: SearchIntentType, mode: ReturnType<typeof mapSearchIntentTypeToMode>) {
  const parsed = parseSearchIntent(q)
  const c = classifyQueryIntent(q, parsed)
  expect(c.intentType, q).toBe(intentType)
  expect(c.mode, q).toBe(mode)
}

describe("classifyQueryIntent (Phase 2.1)", () => {
  it("maps intent types to search modes", () => {
    expect(mapSearchIntentTypeToMode("named_event")).toBe("exact")
    expect(mapSearchIntentTypeToMode("category_place")).toBe("category")
    expect(mapSearchIntentTypeToMode("broad_browse")).toBe("discovery")
    expect(mapSearchIntentTypeToMode("conversational")).toBe("conversational")
    expect(mapSearchIntentTypeToMode("fuzzy")).toBe("discovery")
  })

  describe("named_event", () => {
    it.each([
      ["Paris HYROX"],
      ["Melbourne International Comedy Festival"],
      ["Lantern Festival Alpha"],
      ["when are These New South Whales next gig"],
      ["when is Florence and the Machine playing"],
    ])("%s -> named_event / exact", (q) => {
      expectShape(q, "named_event", "exact")
    })

    it("artist + gig keeps named_event when parser also inferred music interest", () => {
      const q = "when are These New South Whales next gig"
      const parsed = parseSearchIntent(q)
      const withMusic = { ...parsed, interest: ["music"] as string[] }
      const c = classifyQueryIntent(q, withMusic)
      expect(c.intentType).toBe("named_event")
      expect(c.mode).toBe("exact")
    })
  })

  describe("hasNamedArtistPerformanceFraming", () => {
    it("detects when-framed band + gig queries", () => {
      expect(hasNamedArtistPerformanceFraming("when are These New South Whales next gig")).toBe(true)
      expect(hasNamedArtistPerformanceFraming("where are The Wiggles playing")).toBe(true)
    })
    it("rejects category-browse and generic listings", () => {
      expect(hasNamedArtistPerformanceFraming("live music Sydney")).toBe(false)
      expect(hasNamedArtistPerformanceFraming("events in Melbourne")).toBe(false)
      expect(hasNamedArtistPerformanceFraming("fun things to do")).toBe(false)
    })
  })

  describe("category_place", () => {
    it.each([
      ["London theatre"],
      ["live music Sydney"],
      ["art exhibitions Paris"],
    ])("%s -> category_place / category", (q) => {
      expectShape(q, "category_place", "category")
    })
  })

  describe("broad_browse", () => {
    it.each([
      ["events in Melbourne"],
      ["things to do in Brisbane"],
      ["events this weekend"],
    ])("%s -> broad_browse / discovery", (q) => {
      expectShape(q, "broad_browse", "discovery")
    })
  })

  describe("conversational", () => {
    it.each([
      ["what's on in Sydney this weekend"],
      ["something fun tonight in Melbourne"],
    ])("%s -> conversational / conversational", (q) => {
      expectShape(q, "conversational", "conversational")
    })
  })

  describe("fuzzy", () => {
    it("music tonight -> fuzzy / discovery", () => {
      expectShape("music tonight", "fuzzy", "discovery")
    })
    it("fun things near me -> fuzzy / discovery", () => {
      expectShape("fun things near me", "fuzzy", "discovery")
    })
  })

  it("never throws on garbage input", () => {
    expect(() => classifyQueryIntent("   ", parseSearchIntent(""))).not.toThrow()
    const c = classifyQueryIntent("", parseSearchIntent(""))
    expect(c.intentType).toBe("fuzzy")
    expect(c.mode).toBe("discovery")
  })
})
