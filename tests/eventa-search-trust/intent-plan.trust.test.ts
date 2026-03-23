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
    expect(plan.filters.strictTimeOverlap).toBe(false)
    expect(plan.location.city).toBe("Melbourne")
  })

  it("festivals Western Europe resolves region scope", () => {
    const intent = parseSearchIntent("festivals Western Europe")
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

    expect(intent.scope).toBe("region")
    expect(plan.location.region).toBe("Western Europe")
    expect(plan.location.source).toBe("query")
    expect(plan.location.city).toBeUndefined()
    expect(plan.location.country).toBeUndefined()
    expect(plan.location.countries).toEqual(
      expect.arrayContaining(["Germany", "France", "Netherlands", "Belgium", "Luxembourg"]),
    )
  })

  it("travelling to Berlin in May resolves to Berlin (not month May)", () => {
    const q = "I am travelling to Berlin in May what festivals are on"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

    expect(intent.place?.city).toBe("Berlin")
    expect(intent.place?.city).not.toBe("May")
    expect(plan.location.source).toBe("query")
    expect(plan.location.city).toBe("Berlin")
    expect(plan.location.country).toBe("Germany")
  })

  describe("conservative query place extraction", () => {
    it("Music this weekend uses UI location, not query city", () => {
      const intent = parseSearchIntent("Music this weekend")
      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

      expect(intent.place?.city).toBeUndefined()
      expect(plan.location.source).toBe("selected")
      expect(plan.location.city).toBe("Melbourne")
      expect(plan.time.date_from).toBeTruthy()
      expect(plan.time.date_to).toBeTruthy()
    })

    it("Comedy tomorrow has no query city", () => {
      const intent = parseSearchIntent("Comedy tomorrow")
      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

      expect(intent.place?.city).toBeUndefined()
      expect(plan.location.source).toBe("selected")
      expect(plan.location.city).toBe("Melbourne")
      expect(intent.time?.label).toBe("tomorrow")
      expect(intent.time?.date_from).toBeTruthy()
    })

    it("Food near me tonight must not set city to Me", () => {
      const intent = parseSearchIntent("Food near me tonight")
      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

      expect(intent.place?.city).not.toBe("Me")
      expect(intent.place?.city).toBeUndefined()
      expect(plan.location.source).toBe("selected")
      expect(plan.location.city).toBe("Melbourne")
      expect(intent.time?.label).toBe("tonight")
    })

    it("live music Berlin resolves known city from query (true positive)", () => {
      const intent = parseSearchIntent("live music Berlin")
      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

      expect(intent.place?.city).toBe("Berlin")
      expect(intent.placeEvidence).toBe("explicit")
      expect(plan.location.source).toBe("query")
      expect(plan.location.city).toBe("Berlin")
      expect(plan.location.country).toBe("Germany")
      expect(intent.interest).toContain("music")
    })

    it("Brisbane comedy keeps selected scope (trailing city not suffix-anchored)", () => {
      const intent = parseSearchIntent("Brisbane comedy")
      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

      expect(intent.place?.city).toBe("Brisbane")
      expect(intent.placeEvidence).toBe("implicit")
      expect(plan.location.source).toBe("selected")
      expect(plan.location.city).toBe("Melbourne")
    })
  })

  describe("month window intent -> plan", () => {
    it("family events in Berlin in May carries Berlin query + full May window on plan", () => {
      const intent = parseSearchIntent("family events in Berlin in May")
      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

      expect(plan.location.source).toBe("query")
      expect(plan.location.city).toBe("Berlin")
      expect(plan.location.country).toBe("Germany")
      expect(intent.time?.date_from).toBeTruthy()
      expect(intent.time?.date_to).toBeTruthy()
      const from = new Date(intent.time!.date_from!)
      expect(from.getMonth()).toBe(4)
      expect(intent.time?.label).toMatch(/may/i)
    })

    it("markets in Paris in June keeps Paris + June window", () => {
      const intent = parseSearchIntent("markets in Paris in June")
      const plan = resolveSearchPlan(intent, { city: "Sydney", country: "Australia" })

      expect(plan.location.source).toBe("query")
      expect(plan.location.city).toBe("Paris")
      expect(plan.location.country).toBe("France")
      expect(intent.interest).toContain("markets")
      const from = new Date(intent.time!.date_from!)
      expect(from.getMonth()).toBe(5)
      expect(intent.time?.label).toMatch(/june/i)
    })

    it("exhibitions in Rome in May 2026 uses explicit year on time range", () => {
      const intent = parseSearchIntent("exhibitions in Rome in May 2026")
      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })

      expect(plan.location.city).toBe("Rome")
      const from = new Date(intent.time!.date_from!)
      const to = new Date(intent.time!.date_to!)
      expect(from.getFullYear()).toBe(2026)
      expect(to.getFullYear()).toBe(2026)
      expect(from.getMonth()).toBe(4)
      expect(intent.time?.label).toMatch(/may\s+2026/i)
    })
  })
})

