import { describe, expect, it } from "vitest"
import {
  parseSearchIntent,
  rankingCategoryFromParsedIntent,
} from "@/app/lib/search/parseSearchIntent"
import { parseSearchIntent as parseRankingHint } from "@/lib/search/parse-search-intent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { scoreSearchResult } from "@/lib/search/score-search-result"

describe("Eventa trust: search intent context facet", () => {
  it("markets near where I'm hiking → hiking context + markets interest", () => {
    const intent = parseSearchIntent("markets near where I'm hiking")
    expect(intent.interest).toContain("markets")
    expect(intent.context).toContain("hiking")
    expect(intent.place?.city).toBeUndefined()
  })

  it("outdoor live music this weekend → outdoor context + music", () => {
    const intent = parseSearchIntent("outdoor live music this weekend")
    expect(intent.interest).toContain("music")
    expect(intent.context).toContain("outdoor")
    expect(intent.time?.label).toBe("weekend")
  })

  it("free family events in Berlin → price + audience (no fake place from activity)", () => {
    const intent = parseSearchIntent("free family events in Berlin")
    expect(intent.price).toContain("free")
    expect(intent.audience).toContain("family")
    expect(intent.place?.city).toBe("Berlin")
  })

  it("night markets in Paris → night context + markets", () => {
    const intent = parseSearchIntent("night markets in Paris")
    expect(intent.interest).toContain("markets")
    expect(intent.context).toContain("night")
    expect(intent.place?.city).toBe("Paris")
    expect(rankingCategoryFromParsedIntent(intent)).toBe("markets")
  })

  it("kid-friendly things to do near me → kid_friendly context", () => {
    const intent = parseSearchIntent("kid-friendly things to do near me")
    expect(intent.context).toContain("kid_friendly")
    expect(intent.scope).toBe("local")
  })

  it("food and wine events this weekend → wine context + food interest", () => {
    const intent = parseSearchIntent("food and wine events this weekend")
    expect(intent.interest).toContain("food")
    expect(intent.context).toContain("wine")
  })

  it("resolveSearchPlan passes context through", () => {
    const intent = parseSearchIntent("evening markets in Lyon")
    const plan = resolveSearchPlan(intent, { city: "Paris", country: "France" })
    expect(plan.context).toContain("night")
  })

  it("lib parse-search-intent aligns with app intent for category + context", () => {
    const q = "farmers market and wine tasting"
    const hint = parseRankingHint(q)
    const full = parseSearchIntent(q)
    expect(hint.detectedCategory).toBe(rankingCategoryFromParsedIntent(full))
    expect(hint.context).toEqual(full.context ?? [])
  })

  it("theatre maps to theatre interest and ranking, not art", () => {
    const intent = parseSearchIntent("london theatre this weekend")
    expect(intent.interest).toContain("theatre")
    expect(intent.interest).not.toContain("art")
    expect(rankingCategoryFromParsedIntent(intent)).toBe("theatre")
  })

  it("art gallery stays art without theatre interest", () => {
    const intent = parseSearchIntent("contemporary art gallery melbourne")
    expect(intent.interest).toContain("art")
    expect(intent.interest).not.toContain("theatre")
  })

  it("farmers market adds markets_farmers subcategory hint", () => {
    const intent = parseSearchIntent("farmers market Brunswick")
    expect(intent.subcategoryHints).toContain("markets_farmers")
  })
})

describe("Eventa trust: context scoring", () => {
  const NOW = new Date("2026-03-18T12:00:00.000Z")

  it("farmers_market intent ranks grower copy above generic market stall copy", () => {
    const intent = parseSearchIntent("farmers market Brunswick")
    const plan = resolveSearchPlan(intent, { city: "Brunswick", country: "Australia" })
    const future = new Date(NOW.getTime() + 4 * 86400 * 1000).toISOString()

    const growers = {
      title: "Regional Growers Market",
      description: "Organic produce from local farmers.",
      city: "Brunswick",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["markets"],
      category: "MARKETS",
    }
    const generic = {
      title: "Saturday Market",
      description: "Market stalls and gifts in Brunswick.",
      city: "Brunswick",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["markets"],
      category: "MARKETS",
    }

    const a = scoreSearchResult({
      result: growers,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "markets",
    })!
    const b = scoreSearchResult({
      result: generic,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "markets",
    })!

    expect(a.contextScore).toBeGreaterThan(b.contextScore)
    expect(a.total).toBeGreaterThan(b.total)
  })
})
