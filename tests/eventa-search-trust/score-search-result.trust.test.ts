import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { scoreSearchResult } from "@/lib/search/score-search-result"

const NOW = new Date("2026-03-18T12:00:00.000Z")

describe("Eventa trust: deterministic scoreSearchResult", () => {
  it("food intent ranks food event above music in same suburb", () => {
    const q = "food in brunswick"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 5 * 86400 * 1000).toISOString()

    const foodRow = {
      title: "Food Pop-Up",
      description: "Fresh food in Brunswick.",
      city: "Brunswick",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["food"],
      category: "FOOD_DRINK",
    }
    const musicRow = {
      title: "Brunswick Live Set",
      description: "Live music in Brunswick.",
      city: "Brunswick",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["music"],
      category: "MUSIC_NIGHTLIFE",
    }

    const a = scoreSearchResult({
      result: foodRow,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "food",
    })!
    const b = scoreSearchResult({
      result: musicRow,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "food",
    })!

    expect(a.total).toBeGreaterThan(b.total)
    expect(a.interestScore).toBeGreaterThan(b.interestScore)
  })

  it("garage sale Berlin ranks Berlin row above Melbourne bait", () => {
    const q = "garage sale Berlin"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 6 * 86400 * 1000).toISOString()

    const berlin = {
      title: "Neighbourhood Sale",
      description: "Garage sale in Berlin.",
      city: "Berlin",
      country: "Germany",
      startAt: future,
      endAt: future,
      categories: ["markets"],
      category: "MARKETS_FAIRS",
    }
    const melbourne = {
      title: "Inspired Berlin Sale",
      description: "Berlin-themed stalls in Melbourne.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["markets"],
      category: "MARKETS_FAIRS",
    }

    expect(
      scoreSearchResult({
        result: melbourne,
        intent,
        searchPlan: plan,
        now: NOW,
        kind: "internal",
        rankingCategory: "markets",
      }),
    ).toBeNull()

    const berlinScore = scoreSearchResult({
      result: berlin,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "markets",
    })!

    expect(berlinScore.total).toBeGreaterThan(0)
    expect(berlinScore.scopeScore).toBeGreaterThan(20)
  })

  it("Western Europe region excludes non-member country rows", () => {
    const q = "festivals Western Europe"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 7 * 86400 * 1000).toISOString()

    const paris = {
      title: "Paris Night Festival",
      city: "Paris",
      country: "France",
      startAt: future,
      endAt: future,
      categories: ["festival"],
      category: null,
    }
    const melbourne = {
      title: "Melbourne Fair",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["festival"],
      category: null,
    }

    expect(
      scoreSearchResult({
        result: paris,
        intent,
        searchPlan: plan,
        now: NOW,
        kind: "internal",
        rankingCategory: "music",
      }),
    ).not.toBeNull()
    expect(
      scoreSearchResult({
        result: melbourne,
        intent,
        searchPlan: plan,
        now: NOW,
        kind: "internal",
        rankingCategory: "music",
      }),
    ).toBeNull()
  })

  it("broad query does not apply strict time hard exclusion", () => {
    const q = "things to do"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    expect(plan.filters.strictTimeOverlap).toBe(false)
    const past = new Date(NOW.getTime() - 3 * 86400 * 1000).toISOString()

    const row = {
      title: "Neighbourhood Night",
      description: "Things to do in Melbourne.",
      city: "Melbourne",
      country: "Australia",
      startAt: past,
      endAt: past,
      categories: [],
      category: null,
    }

    const s = scoreSearchResult({
      result: row,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
    })
    expect(s).not.toBeNull()
  })

  it("internal source scores higher than web at same relevance", () => {
    const q = "live music"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 86400 * 1000).toISOString()

    const base = {
      title: "Live music set",
      description: "Music in Melbourne tonight.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["music"],
      category: "MUSIC_NIGHTLIFE",
    }

    const internal = scoreSearchResult({
      result: base,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "music",
    })!
    const web = scoreSearchResult({
      result: { ...base, externalUrl: "https://example.com/e" },
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "web",
      rankingCategory: "music",
      webListingBoost: 0,
    })!

    expect(internal.sourceScore).toBeGreaterThan(web.sourceScore)
    expect(internal.total).toBeGreaterThan(web.total)
  })
})

describe("Eventa trust: broad + parsed time uses strict overlap in ranking", () => {
  const frozenNow = new Date("2026-03-18T12:00:00.000Z")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-18T10:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("what's happening this weekend drops rows outside the weekend window", () => {
    const intent = parseSearchIntent("what's happening this weekend")
    expect(intent.scope).toBe("broad")
    expect(intent.time?.date_from).toBeTruthy()
    expect(intent.time?.date_to).toBeTruthy()
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    expect(plan.filters.strictCategory).toBe(false)
    expect(plan.filters.strictTimeOverlap).toBe(true)

    const saturday = new Date("2026-03-21T15:00:00.000Z").toISOString()
    const followingTuesday = new Date("2026-03-24T12:00:00.000Z").toISOString()

    expect(
      scoreSearchResult({
        result: {
          title: "Weekend fair",
          city: "Melbourne",
          country: "Australia",
          startAt: saturday,
          endAt: saturday,
        },
        intent,
        searchPlan: plan,
        now: frozenNow,
        kind: "internal",
      }),
    ).not.toBeNull()

    expect(
      scoreSearchResult({
        result: {
          title: "Tuesday talk",
          city: "Melbourne",
          country: "Australia",
          startAt: followingTuesday,
          endAt: followingTuesday,
        },
        intent,
        searchPlan: plan,
        now: frozenNow,
        kind: "internal",
      }),
    ).toBeNull()
  })

  it("what's on next week drops rows outside next calendar week", () => {
    const intent = parseSearchIntent("what's on next week")
    expect(intent.scope).toBe("broad")
    expect(planFrom(intent).filters.strictTimeOverlap).toBe(true)

    const thisWeekSaturday = new Date("2026-03-21T12:00:00.000Z").toISOString()
    const nextWeekWednesday = new Date("2026-03-25T12:00:00.000Z").toISOString()

    const plan = planFrom(intent)

    expect(
      scoreSearchResult({
        result: {
          title: "This week only",
          city: "Melbourne",
          country: "Australia",
          startAt: thisWeekSaturday,
          endAt: thisWeekSaturday,
        },
        intent,
        searchPlan: plan,
        now: frozenNow,
        kind: "internal",
      }),
    ).toBeNull()

    expect(
      scoreSearchResult({
        result: {
          title: "Next week gig",
          city: "Melbourne",
          country: "Australia",
          startAt: nextWeekWednesday,
          endAt: nextWeekWednesday,
        },
        intent,
        searchPlan: plan,
        now: frozenNow,
        kind: "internal",
      }),
    ).not.toBeNull()
  })

  it("events in Paris in May drops rows outside May window", () => {
    const intent = parseSearchIntent("events in Paris in May")
    expect(intent.scope).toBe("city")
    expect(intent.place?.city).toBe("Paris")
    const plan = resolveSearchPlan(intent, { city: "Lyon", country: "France" })
    expect(plan.filters.strictCategory).toBe(true)
    expect(plan.filters.strictTimeOverlap).toBe(true)

    const inMay = new Date("2026-05-10T12:00:00.000Z").toISOString()
    const inJune = new Date("2026-06-05T12:00:00.000Z").toISOString()

    expect(
      scoreSearchResult({
        result: {
          title: "May festival",
          city: "Paris",
          country: "France",
          startAt: inMay,
          endAt: inMay,
        },
        intent,
        searchPlan: plan,
        now: frozenNow,
        kind: "internal",
      }),
    ).not.toBeNull()

    expect(
      scoreSearchResult({
        result: {
          title: "June show",
          city: "Paris",
          country: "France",
          startAt: inJune,
          endAt: inJune,
        },
        intent,
        searchPlan: plan,
        now: frozenNow,
        kind: "internal",
      }),
    ).toBeNull()
  })

  function planFrom(i: ReturnType<typeof parseSearchIntent>) {
    return resolveSearchPlan(i, { city: "Melbourne", country: "Australia" })
  }
})
