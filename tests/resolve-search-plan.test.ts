import { describe, expect, it } from "vitest"
import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"

function makeIntent(partial: Partial<SearchIntent> & Pick<SearchIntent, "scope" | "placeEvidence">): SearchIntent {
  return {
    rawQuery: partial.rawQuery ?? "",
    scope: partial.scope,
    placeEvidence: partial.placeEvidence,
    place: partial.place,
    interest: partial.interest,
    time: partial.time,
    audience: partial.audience,
    price: partial.price,
    confidence: partial.confidence,
  }
}

describe("resolveSearchPlan — query vs selected precedence (placeEvidence)", () => {
  it("no query place -> selected wins", () => {
    const intent = makeIntent({
      scope: "local",
      placeEvidence: "none",
    })
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    expect(plan.location.source).toBe("selected")
    expect(plan.location.city).toBe("Melbourne")
    expect(plan.location.country).toBe("Australia")
  })

  it("explicit query place -> query wins over selected", () => {
    const intent = makeIntent({
      scope: "city",
      placeEvidence: "explicit",
      place: { city: "Patra", country: "Greece", raw: "Patra" },
    })
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    expect(plan.location.source).toBe("query")
    expect(plan.location.city).toBe("Patra")
    expect(plan.location.country).toBe("Greece")
  })

  it("implicit query place -> selected wins", () => {
    const intent = makeIntent({
      scope: "city",
      placeEvidence: "implicit",
      place: { city: "Richmond", country: "Australia", raw: "Richmond" },
    })
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    expect(plan.location.source).toBe("selected")
    expect(plan.location.city).toBe("Melbourne")
    expect(plan.location.country).toBe("Australia")
  })

  it("no selected + explicit query place -> query wins", () => {
    const intent = makeIntent({
      scope: "city",
      placeEvidence: "explicit",
      place: { city: "Athens", country: "Greece", raw: "Athens" },
    })
    const plan = resolveSearchPlan(intent, null)
    expect(plan.location.source).toBe("query")
    expect(plan.location.city).toBe("Athens")
    expect(plan.location.country).toBe("Greece")
  })

  it("global query -> no location restriction", () => {
    const intent = makeIntent({
      scope: "global",
      placeEvidence: "explicit",
      place: { city: "Berlin", country: "Germany" },
    })
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    expect(plan.filters.applyLocationRestriction).toBe(false)
    expect(plan.location.city).toBeUndefined()
    expect(plan.location.country).toBeUndefined()
  })
})
