import { describe, it, expect } from "vitest"
import {
  buildStructuredCityLocationOrClause,
  applyStrictInternalCityFilter,
} from "@/lib/search/search-location-clause"

describe("buildStructuredCityLocationOrClause", () => {
  it("explicit_query omits parentCity and title/description-style OR branches", () => {
    const clause = buildStructuredCityLocationOrClause("Brunswick", "explicit_query")
    const keys = clause.OR.map((o) => Object.keys(o)[0])
    expect(keys.every((k) => k === "city")).toBe(true)
    expect(clause.OR.length).toBeGreaterThan(0)
  })

  it("inclusive adds parentCity and text fallbacks", () => {
    const clause = buildStructuredCityLocationOrClause("Melbourne", "inclusive")
    const keys = new Set(clause.OR.map((o) => Object.keys(o)[0]))
    expect(keys.has("city")).toBe(true)
    expect(keys.has("parentCity")).toBe(true)
    expect(keys.has("title")).toBe(true)
    expect(keys.has("description")).toBe(true)
  })
})

describe("applyStrictInternalCityFilter", () => {
  it("explicit mode ignores parentCity (Berlin vs Melbourne bait)", () => {
    const events = [
      { city: "Melbourne", parentCity: "Melbourne" },
      { city: "Berlin", parentCity: null },
    ]
    const r = applyStrictInternalCityFilter(events, "Berlin", { allowParentCityMatch: false })
    expect(r.count).toBe(1)
    expect(r.events[0].city).toBe("Berlin")
  })

  it("UI mode keeps suburb row when parentCity matches metro", () => {
    const events = [{ city: "Brunswick", parentCity: "Melbourne" }]
    const r = applyStrictInternalCityFilter(events, "Melbourne", { allowParentCityMatch: true })
    expect(r.count).toBe(1)
  })
})
