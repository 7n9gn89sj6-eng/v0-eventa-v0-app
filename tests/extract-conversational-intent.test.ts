import { describe, expect, it } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { classifyQueryIntent } from "@/lib/search/classifyQueryIntent"
import {
  buildConversationalOverlapSupplement,
  extractConversationalIntent,
  shouldRunConversationalExtraction,
} from "@/lib/search/extractConversationalIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { queryTextOverlapScore } from "@/lib/search/score-search-result"

const NOW = new Date("2026-03-18T12:00:00.000Z")

function ext(q: string) {
  const parsed = parseSearchIntent(q)
  const cls = classifyQueryIntent(q, parsed)
  return extractConversationalIntent({
    rawQuery: q,
    parsedIntent: parsed,
    queryIntentType: cls.intentType,
    searchMode: cls.mode,
  })
}

describe("extractConversationalIntent (Phase 2.3)", () => {
  it("does not run for named_event; category_place only with time/browse cue", () => {
    expect(shouldRunConversationalExtraction("exact", "named_event")).toBe(false)
    expect(shouldRunConversationalExtraction("category", "category_place", "comedy in London")).toBe(false)
    expect(
      shouldRunConversationalExtraction("category", "category_place", "comedy this Friday in London"),
    ).toBe(true)
    expect(shouldRunConversationalExtraction("conversational", "conversational")).toBe(true)
  })

  it("what's on in Sydney this weekend → place + time + browse", () => {
    const e = ext("what's on in Sydney this weekend")
    expect(e).not.toBeNull()
    expect(e!.inferredBrowseIntent).toBe(true)
    expect(e!.inferredTimeText).toMatch(/weekend/i)
    expect(e!.inferredPlaceText?.toLowerCase()).toContain("sydney")
  })

  it("something fun tonight in Melbourne → place + time + browse + entertainment", () => {
    const e = ext("something fun tonight in Melbourne")
    expect(e).not.toBeNull()
    expect(e!.inferredBrowseIntent).toBe(true)
    expect(e!.inferredTimeText).toBe("tonight")
    expect(e!.inferredPlaceText?.toLowerCase()).toContain("melbourne")
    expect(e!.inferredCategory).toBe("entertainment")
  })

  it("music tonight → music + tonight", () => {
    const e = ext("music tonight")
    expect(e).not.toBeNull()
    expect(e!.inferredCategory).toBe("music")
    expect(e!.inferredTimeText).toBe("tonight")
  })

  it("fun things near me → browse-ish + near me", () => {
    const e = ext("fun things near me")
    expect(e).not.toBeNull()
    expect(e!.inferredPlaceText).toMatch(/near me/i)
    expect(e!.inferredCategory).toBe("entertainment")
  })

  it("anything happening in Paris tomorrow", () => {
    const e = ext("anything happening in Paris tomorrow")
    expect(e).not.toBeNull()
    expect(e!.inferredBrowseIntent).toBe(true)
    expect(e!.inferredPlaceText?.toLowerCase()).toContain("paris")
    expect(e!.inferredTimeText).toBe("tomorrow")
  })

  it("comedy this Friday in London", () => {
    const e = ext("comedy this Friday in London")
    expect(e).not.toBeNull()
    expect(e!.inferredCategory).toBe("comedy")
    expect(e!.inferredTimeText).toContain("friday")
    expect(e!.inferredPlaceText?.toLowerCase()).toContain("london")
  })

  it("guardrail named queries → null extraction", () => {
    for (const q of [
      "Lantern Festival Alpha",
      "Paris HYROX",
      "London theatre",
    ]) {
      expect(ext(q), q).toBeNull()
    }
  })

  it("never throws on garbage", () => {
    expect(() =>
      extractConversationalIntent({
        rawQuery: "   ",
        queryIntentType: "fuzzy",
        searchMode: "discovery",
      }),
    ).not.toThrow()
  })

  it("overlap supplement is non-empty for fuzzy music + time", () => {
    const q = "music tonight"
    const parsed = parseSearchIntent(q)
    const e = extractConversationalIntent({
      rawQuery: q,
      parsedIntent: parsed,
      queryIntentType: "fuzzy",
      searchMode: "discovery",
    })
    expect(e).not.toBeNull()
    expect(buildConversationalOverlapSupplement(e!).length).toBeGreaterThan(3)
    const row = {
      title: "Northside live music",
      description: "Tonight only.",
      city: "Melbourne",
      country: "Australia",
      startAt: NOW.toISOString(),
      endAt: NOW.toISOString(),
      categories: ["music"],
      category: "MUSIC",
    }
    expect(queryTextOverlapScore(parsed, row, buildConversationalOverlapSupplement(e!))).toBeGreaterThanOrEqual(
      queryTextOverlapScore(parsed, row),
    )
  })

  it("named_event path: no extraction → production would not add supplement", () => {
    const q = "Lantern Festival Alpha"
    const parsed = parseSearchIntent(q)
    const cls = classifyQueryIntent(q, parsed)
    expect(cls.intentType).toBe("named_event")
    expect(
      extractConversationalIntent({
        rawQuery: q,
        parsedIntent: parsed,
        queryIntentType: cls.intentType,
        searchMode: cls.mode,
      }),
    ).toBeNull()
  })
})

describe("buildConversationalOverlapSupplement", () => {
  it("joins fields", () => {
    const s = buildConversationalOverlapSupplement({
      inferredCategory: "music",
      inferredTimeText: "tonight",
      inferredPlaceText: "Melbourne",
      inferredBrowseIntent: true,
      confidence: 0.7,
      reasons: [],
    })
    expect(s).toContain("music")
    expect(s).toContain("tonight")
    expect(s).toContain("Melbourne")
  })
})
