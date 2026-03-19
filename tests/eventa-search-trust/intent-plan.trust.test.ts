import { describe, expect, it } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"

describe("Eventa trust: intent -> plan foundation", () => {
  it("garage sale Berlin resolves to Berlin even if selected is Melbourne", () => {
    const intent = parseSearchIntent("garage sale Berlin")
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

    expect(plan.location.source).toBe("query")
    expect(plan.location.city).toBe("Berlin")
  })

  it("music this weekend uses selected location when query has no place", () => {
    const intent = parseSearchIntent("music this weekend")
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

    expect(plan.location.source).toBe("selected")
    expect(plan.location.city).toBe("Melbourne")
    expect(plan.time.date_from).toBeTruthy()
    expect(plan.time.date_to).toBeTruthy()
  })

  it("music in Camberwell UK resolves country as United Kingdom", () => {
    const intent = parseSearchIntent("music in Camberwell UK")
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

    expect(plan.location.source).toBe("query")
    expect(plan.location.city).toBe("Camberwell")
    expect(plan.location.country).toBe("United Kingdom")
  })

  it("things to do resolves broad scope", () => {
    const intent = parseSearchIntent("things to do")
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

    expect(intent.scope).toBe("broad")
    expect(plan.filters.strictCategory).toBe(false)
    expect(plan.location.city).toBe("Melbourne")
  })

  it("festivals Western Europe resolves region scope", () => {
    const intent = parseSearchIntent("festivals Western Europe")
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

    expect(intent.scope).toBe("region")
    expect(plan.location.region).toBe("Western Europe")
    expect(plan.location.source).toBe("query")
  })
})

