import { describe, expect, it } from "vitest"
import { parseSearchIntent, type SearchIntent } from "@/app/lib/search/parseSearchIntent"
import {
  stripPlaceTokenFromQuery,
  topicQueryForCityLevelWeb,
} from "@/lib/search/topic-query-for-city-level-web"

function implicitBrisbaneIntent() {
  const intent = parseSearchIntent("Brisbane comedy")
  expect(intent.placeEvidence).toBe("implicit")
  return intent
}

describe("topicQueryForCityLevelWeb", () => {
  it("selected scope + implicit place: removes weak city from q (Brisbane comedy -> comedy)", () => {
    const intent = implicitBrisbaneIntent()
    const out = topicQueryForCityLevelWeb("Brisbane comedy", intent, "selected")
    expect(out.toLowerCase()).toBe("comedy")
    expect(out.toLowerCase()).not.toContain("brisbane")
  })

  it("explicit markets in Patra leaves q unchanged when execution is query-sourced", () => {
    const intent = parseSearchIntent("markets in Patra")
    expect(intent.placeEvidence).toBe("explicit")
    const q = "markets in Patra"
    expect(topicQueryForCityLevelWeb(q, intent, "query")).toBe(q)
  })

  it("explicit Patra is unchanged even if source were selected (no strip for non-implicit)", () => {
    const intent = parseSearchIntent("markets in Patra")
    expect(intent.placeEvidence).toBe("explicit")
    const q = "markets in Patra"
    expect(topicQueryForCityLevelWeb(q, intent, "selected")).toBe(q)
  })

  it("implicit evidence but no raw/city to strip -> unchanged", () => {
    const q = "food and drinks"
    const intent: SearchIntent = {
      rawQuery: q,
      scope: "local",
      placeEvidence: "implicit",
    }
    expect(topicQueryForCityLevelWeb(q, intent, "selected")).toBe(q)
  })

  it("word-boundary: does not strip inside a longer token (brisbanex)", () => {
    const q = "brisbanex comedy"
    const intent: ReturnType<typeof parseSearchIntent> = {
      rawQuery: q,
      scope: "city",
      placeEvidence: "implicit",
      place: { city: "Brisbane", country: "Australia", raw: "Brisbane" },
    }
    expect(topicQueryForCityLevelWeb(q, intent, "selected")).toBe(q)
  })
})

describe("stripPlaceTokenFromQuery", () => {
  it("removes only whole-word matches", () => {
    expect(stripPlaceTokenFromQuery("in brisbane inner north", "Brisbane")).toBe("in inner north")
  })
})
