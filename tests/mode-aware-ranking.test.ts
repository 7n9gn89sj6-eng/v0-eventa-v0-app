import { describe, expect, it } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { classifyQueryIntent } from "@/lib/search/classifyQueryIntent"
import {
  buildWebPhraseMatchRawText,
  computePhraseTitleBoost,
  extraWeakGenericWebPenalty,
  shouldApplySearchMode,
} from "@/lib/search/mode-aware-ranking"
import { scoreSearchResult } from "@/lib/search/score-search-result"

const NOW = new Date("2026-03-18T12:00:00.000Z")

describe("mode-aware ranking (Phase 2.2)", () => {
  it("baseline unchanged when searchMode omitted", () => {
    const q = "live music Melbourne"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 5 * 86400 * 1000).toISOString()
    const row = {
      title: "Northside Jazz Quartet",
      description: "Live jazz.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["music"],
      category: "MUSIC",
    }
    const a = scoreSearchResult({
      result: row,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "music",
    })!
    const b = scoreSearchResult({
      result: row,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "music",
      searchMode: undefined,
      queryIntentConfidence: undefined,
    })!
    expect(a.total).toBe(b.total)
    expect(a.modeAdjustment).toBe(0)
  })

  it("exact mode widens gap: internal vs generic web hub", () => {
    const q = "Paris HYROX"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Paris", country: "France" })
    const future = new Date(NOW.getTime() + 5 * 86400 * 1000).toISOString()
    const internalRow = {
      title: "Paris HYROX Fitness Competition",
      description: "HYROX race in Paris.",
      city: "Paris",
      country: "France",
      startAt: future,
      endAt: future,
      category: "SPORTS",
      categories: ["fitness"],
    }
    const genericWeb = {
      title: "What's On Paris",
      description: "Things to do and browse all events in Paris.",
      city: "Paris",
      country: "France",
      startAt: future,
      endAt: future,
      externalUrl: "https://visit.example.com/things-to-do/paris",
      _originalUrl: "https://visit.example.com/things-to-do/paris",
    }

    const baseInternal = scoreSearchResult({
      result: internalRow,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "sports",
    })!
    const baseWeb = scoreSearchResult({
      result: genericWeb,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "web",
      rankingCategory: "sports",
    })!
    const exactInternal = scoreSearchResult({
      result: internalRow,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "sports",
      searchMode: "exact",
      queryIntentConfidence: 0.9,
    })!
    const exactWeb = scoreSearchResult({
      result: genericWeb,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "web",
      rankingCategory: "sports",
      searchMode: "exact",
      queryIntentConfidence: 0.9,
    })!

    expect(exactInternal.total).toBeGreaterThan(baseInternal.total)
    expect(exactWeb.total).toBeLessThan(baseWeb.total)
    expect(exactInternal.total).toBeGreaterThan(exactWeb.total)
    expect(exactInternal.modeAdjustment).toBeGreaterThan(0)
  })

  it("discovery mode boosts internal row vs baseline", () => {
    const q = "events in Melbourne"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 4 * 86400 * 1000).toISOString()
    const row = {
      title: "Community Meetup",
      description: "Local gathering.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["community"],
      category: "COMMUNITY",
    }
    const cls = classifyQueryIntent(q, intent)
    expect(cls.mode).toBe("discovery")
    const base = scoreSearchResult({
      result: row,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: undefined,
    })!
    const tuned = scoreSearchResult({
      result: row,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: undefined,
      searchMode: "discovery",
      queryIntentConfidence: cls.confidence,
    })!
    expect(tuned.total).toBeGreaterThan(base.total)
  })

  it("helpers: phrase boost and weak-web extra only when expected", () => {
    const intent = parseSearchIntent("Lantern Festival Alpha")
    const internal = { title: "Eventa Test: Melbourne Lantern Festival Alpha" }
    expect(
      computePhraseTitleBoost(intent, internal, "exact", true, 20, "internal"),
    ).toBeGreaterThan(0)
    const webRow = { title: "Melbourne Lantern Festival Alpha — tickets" }
    expect(computePhraseTitleBoost(intent, webRow, "exact", true, 20, "web")).toBe(10)
    expect(computePhraseTitleBoost(intent, internal, "category", true, 20, "internal")).toBe(0)

    expect(
      extraWeakGenericWebPenalty({
        mode: "exact",
        active: true,
        kind: "web",
        textOverlapScore: 2,
        baseGenericWebPenalty: 16,
        extraCap: 18,
      }),
    ).toBe(18)
    expect(
      extraWeakGenericWebPenalty({
        mode: "exact",
        active: true,
        kind: "web",
        textOverlapScore: 10,
        baseGenericWebPenalty: 16,
        extraCap: 18,
      }),
    ).toBe(0)

    expect(shouldApplySearchMode("exact", 0.88)).toBe(true)
    expect(shouldApplySearchMode("exact", 0.35)).toBe(false)
    expect(shouldApplySearchMode(undefined, 0.9)).toBe(false)
  })

  it("exact web: MICF-style weak title but festival name in description gets phrase boost", () => {
    const intent = parseSearchIntent("Melbourne International Comedy Festival")
    const webRow = {
      title: "Home",
      description: "The Melbourne International Comedy Festival returns with shows across the city.",
      externalUrl: "https://comedyfestival.com.au/",
    }
    expect(computePhraseTitleBoost(intent, webRow, "exact", true, 24, "web")).toBeGreaterThan(0)
    expect(buildWebPhraseMatchRawText(webRow).toLowerCase()).toContain("melbourne")
  })

  it("exact web: Paris HYROX match via URL slug when title is generic", () => {
    const intent = parseSearchIntent("Paris HYROX")
    const webRow = {
      title: "Official site",
      description: "",
      externalUrl: "https://hyrox.com/paris-hyrox/",
    }
    expect(computePhraseTitleBoost(intent, webRow, "exact", true, 24, "web")).toBeGreaterThan(0)
  })

  it("exact internal: phrase boost still uses title only (ignores description)", () => {
    const intent = parseSearchIntent("Unique Gala Night Alpha")
    const internal = {
      title: "Some other show",
      description: "Unique Gala Night Alpha is our headline event.",
    }
    expect(computePhraseTitleBoost(intent, internal, "exact", true, 20, "internal")).toBe(0)
    const webSame = {
      title: "Some other show",
      description: "Unique Gala Night Alpha is our headline event.",
      externalUrl: "https://venue.example.com/events/unique-gala-night-alpha",
    }
    expect(computePhraseTitleBoost(intent, webSame, "exact", true, 20, "web")).toBeGreaterThan(0)
  })
})
