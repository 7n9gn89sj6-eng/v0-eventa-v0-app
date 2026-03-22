import { describe, it, expect } from "vitest"
import {
  buildPhase1Interpretation,
  categoriesDisagree,
  dateRangesNonOverlapping,
} from "@/lib/search/phase1-interpretation"
import type { InterpretedSearchIntent } from "@/lib/search/ai-intent"

const baseInput = {
  q: "test",
  interpretThrew: false,
  executionCategory: "music" as string | null,
  executionDateFrom: "2026-03-01T00:00:00.000Z" as string | null,
  executionDateTo: "2026-03-07T23:59:59.000Z" as string | null,
  executionPlace: { city: "Berlin" as string | null, country: "Germany" as string | null },
  parsedIntent: { interest: ["music"] as string[] },
}

function aiInterpreted(
  partial: Partial<InterpretedSearchIntent> & Pick<InterpretedSearchIntent, "source">,
): InterpretedSearchIntent {
  return {
    rawQuery: "q",
    source: partial.source,
    category: partial.category,
    date_from: partial.date_from,
    date_to: partial.date_to,
    confidence: partial.confidence ?? 0.9,
  }
}

describe("phase1-interpretation", () => {
  it("dateRangesNonOverlapping is false when ranges overlap", () => {
    expect(
      dateRangesNonOverlapping(
        "2026-03-01T00:00:00.000Z",
        "2026-03-07T00:00:00.000Z",
        "2026-03-05T00:00:00.000Z",
        "2026-03-10T00:00:00.000Z",
      ),
    ).toBe(false)
  })

  it("dateRangesNonOverlapping is true when ranges are disjoint", () => {
    expect(
      dateRangesNonOverlapping(
        "2026-03-01T00:00:00.000Z",
        "2026-03-07T00:00:00.000Z",
        "2026-03-10T00:00:00.000Z",
        "2026-03-15T00:00:00.000Z",
      ),
    ).toBe(true)
  })

  it("categoriesDisagree when both set and differ", () => {
    expect(categoriesDisagree("music", "food")).toBe(true)
    expect(categoriesDisagree("music", "Music")).toBe(false)
    expect(categoriesDisagree("all", "food")).toBe(false)
    expect(categoriesDisagree("music", undefined)).toBe(false)
  })

  it("adds ai_suggestion when source is ai and category disagrees", () => {
    const interpreted = aiInterpreted({
      source: "ai",
      category: "food",
      confidence: 0.9,
    })
    const p = buildPhase1Interpretation({
      ...baseInput,
      interpreted,
    })
    const chip = p.facets.find((f) => f.kind === "ai_suggestion")
    expect(chip?.kind).toBe("ai_suggestion")
    if (chip?.kind === "ai_suggestion") {
      expect(chip.displayLabel).toContain("food")
      expect(chip.displayLabel).toContain("not used for results")
    }
  })

  it("prefers date label when both date and category disagree", () => {
    const interpreted = aiInterpreted({
      source: "ai",
      category: "food",
      date_from: "2026-04-01T00:00:00.000Z",
      date_to: "2026-04-07T00:00:00.000Z",
      confidence: 0.9,
    })
    const p = buildPhase1Interpretation({
      ...baseInput,
      interpreted,
    })
    const chip = p.facets.find((f) => f.kind === "ai_suggestion")
    expect(chip?.kind).toBe("ai_suggestion")
    if (chip?.kind === "ai_suggestion") {
      expect(chip.displayLabel).toMatch(/Apr/)
      expect(chip.displayLabel).not.toContain("food")
    }
  })

  it("does not add ai_suggestion for rules source", () => {
    const interpreted = aiInterpreted({
      source: "rules",
      category: "food",
    })
    const p = buildPhase1Interpretation({
      ...baseInput,
      interpreted,
    })
    expect(p.facets.some((f) => f.kind === "ai_suggestion")).toBe(false)
  })

  it("sets meta.aiAttempted false when q is empty", () => {
    const p = buildPhase1Interpretation({
      ...baseInput,
      q: "",
      interpreted: null,
    })
    expect(p.meta.aiAttempted).toBe(false)
    expect(p.meta.aiSucceeded).toBe(false)
  })
})
