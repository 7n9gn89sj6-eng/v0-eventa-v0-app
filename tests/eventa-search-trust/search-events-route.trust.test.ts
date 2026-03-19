import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest"
import {
  type FixtureInternalEvent,
  matchesPrismaWhere,
  deepIncludesString,
} from "./prisma-where-matcher"
import { parseDateExpression } from "@/lib/search/query-parser"

const FIXED_NOW = new Date("2026-03-18T10:00:00.000Z")

// Test-controlled fixtures
let fixtureInternalEvents: FixtureInternalEvent[] = []
let fixtureWebResults: any[] = []

const findManyWhereHistory: any[] = []

const prismaFindMany = vi.fn(async (args: any) => {
  findManyWhereHistory.push(args?.where)

  const where = args?.where
  const skip = Number.parseInt(String(args?.skip ?? 0), 10) || 0
  const take = Number.parseInt(String(args?.take ?? 20), 10) || 20

  const matched = fixtureInternalEvents.filter((e) => matchesPrismaWhere(e, where))
  return matched.slice(skip, skip + take)
})

const prismaCount = vi.fn(async (args: any) => {
  const where = args?.where
  const matched = fixtureInternalEvents.filter((e) => matchesPrismaWhere(e, where))
  return matched.length
})

const searchWeb = vi.fn(async () => fixtureWebResults)

vi.mock("@/lib/db", () => {
  return {
    default: {
      event: {
        findMany: prismaFindMany,
        count: prismaCount,
      },
    },
  }
})

vi.mock("@/lib/search/web-search", () => {
  return { searchWeb }
})

describe("Eventa trust: /api/search/events regression suite", () => {
  let GET: (req: any) => Promise<any>

  // Silence route spam (keeps test output readable)
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

  beforeAll(async () => {
    process.env.EVENTA_ENABLE_AI_INTENT = "false"

    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)

    const mod = await import("@/app/api/search/events/route")
    GET = mod.GET
  })

  afterAll(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    vi.useRealTimers()
  })

  beforeEach(() => {
    fixtureInternalEvents = []
    fixtureWebResults = []
    findManyWhereHistory.length = 0
    prismaFindMany.mockClear()
    prismaCount.mockClear()
    searchWeb.mockClear()
  })

  function addHours(iso: string, hours: number): string {
    const d = new Date(iso)
    d.setTime(d.getTime() + hours * 3600 * 1000)
    return d.toISOString()
  }

  function makeEvent(
    input: Omit<FixtureInternalEvent, "categories" | "category"> & {
      categories?: string[]
      category?: string | null
    },
  ): FixtureInternalEvent {
    return {
      venueName: null,
      categories: input.categories ?? [],
      category: input.category ?? null,
      ...input,
    }
  }

  async function callSearchEvents(opts: {
    query: string
    city?: string
    country?: string
    debug?: boolean
  }) {
    const url = new URL("http://localhost/api/search/events")
    url.searchParams.set("query", opts.query)
    if (opts.city) url.searchParams.set("city", opts.city)
    if (opts.country) url.searchParams.set("country", opts.country)
    if (opts.debug) url.searchParams.set("debug", "1")

    const req = { url: url.toString() } as any
    const res = await GET(req)
    return await res.json()
  }

  it("explicit query location overrides UI location (`markets in Berlin`)", async () => {
    const future = new Date(FIXED_NOW.getTime() + 5 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "berlin-markets",
        title: "Neighbourhood Finds Pop-Up",
        description: "Markets and fairs in Berlin with local stalls.",
        city: "Berlin",
        country: "Germany",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["markets"],
        category: "MARKETS_FAIRS",
      }),
      makeEvent({
        id: "melbourne-markets",
        title: "Melbourne Markets",
        // Include 'Berlin' so text/location filtering could accidentally match if override breaks
        description: "Berlin-inspired stalls at Melbourne markets.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["markets"],
        category: "MARKETS_FAIRS",
      }),
    ]

    fixtureWebResults = [
      {
        source: "web",
        title: "Berlin Markets Guide",
        snippet: "What to do in Berlin",
        url: "https://example.com/berlin-markets-guide",
        startAt: future,
      },
    ]

    const data = await callSearchEvents({
      query: "markets in Berlin",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("query")
    expect(data?.effectiveLocation?.city).toBe("Berlin")

    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Berlin")
    expect(internalCities).not.toContain("Melbourne")

    // Internal-first contract
    expect((data.events?.[0] as any)?.source).toBe("internal")
  })

  it("explicit suburb is respected (`food in brunswick` uses Brunswick internally)", async () => {
    const future = new Date(FIXED_NOW.getTime() + 4 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "brunswick-food",
        title: "Food Pop-Up",
        description: "Fresh food in Brunswick for the whole family.",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["food"],
        category: "FOOD_DRINK",
      }),
      makeEvent({
        id: "brunswick-music",
        title: "Brunswick Live Set",
        description: "Live music in Brunswick (no food).",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
      makeEvent({
        id: "townsville-food-leak",
        title: "Queensland Food Night",
        // Include 'Brunswick' so city filtering could accidentally match via description if override breaks
        description: "Food in Brunswick but located in Townsville.",
        city: "Townsville",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["food"],
        category: "FOOD_DRINK",
      }),
    ]

    const data = await callSearchEvents({
      query: "food in brunswick",
      city: "Melbourne",
      country: "Australia",
    })

    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Brunswick")
    expect(internalCities).not.toContain("Townsville")

    const internalTopCategories = (data.internal?.[0]?.categories ?? []) as string[]
    expect(internalTopCategories.join(",").toLowerCase()).toContain("food")
  })

  it("no cross-city leakage + time phrase interpreted (`music this weekend`)", async () => {
    const weekend = parseDateExpression("music this weekend")
    expect(weekend.date_from).toBeTruthy()
    expect(weekend.date_to).toBeTruthy()

    const start = weekend.date_from!
    const end = addHours(start, 3)

    const outsideStart = new Date(new Date(start).getTime() - 2 * 86400 * 1000).toISOString()
    const outsideEnd = addHours(outsideStart, 2)

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-music-weekend",
        title: "Laneway Vinyl Afternoon",
        // Intentionally omit 'weekend' token
        description: "Live music on vinyl with local DJs.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
      makeEvent({
        id: "tville-music-weekend-should-not-leak",
        title: "Queensland After Dark",
        description: "Melbourne inspired after dark music. (Still Townsville.)",
        city: "Townsville",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
      makeEvent({
        id: "melb-music-outside-weekend",
        title: "Midweek Gig",
        description: "Live music midweek.",
        city: "Melbourne",
        country: "Australia",
        startAt: outsideStart,
        endAt: outsideEnd,
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
    ]

    const data = await callSearchEvents({
      query: "music this weekend",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.city).toBe("Melbourne")
    expect(data?.effectiveLocation?.source).toBe("ui")

    const fromMs = new Date(weekend.date_from!).getTime()
    const toMs = new Date(weekend.date_to!).getTime()

    for (const e of data.internal || []) {
      expect(e.city).toBe("Melbourne")
      const st = new Date(e.startAt).getTime()
      expect(st).toBeGreaterThanOrEqual(fromMs)
      expect(st).toBeLessThanOrEqual(toMs)
      expect(String(e.description || "").toLowerCase()).not.toContain("weekend")
    }
  })

  it("time-only query does not poison text matching (`this weekend`)", async () => {
    const weekend = parseDateExpression("this weekend")
    const start = weekend.date_from!
    const end = addHours(start, 2)

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-weekend-event",
        title: "Local Music & Community Night",
        description: "A live set and community stalls.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: [],
        category: null,
      }),
      makeEvent({
        id: "melb-not-weekend",
        title: "Next Week Teaser",
        description: "A live set and community stalls.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(start, -72),
        endAt: addHours(start, -71),
        categories: [],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "this weekend",
      city: "Melbourne",
      country: "Australia",
    })

    expect((data.internal || []).length).toBeGreaterThan(0)
    expect((data.internal || []).every((e: any) => e.city === "Melbourne")).toBe(true)
  })

  it("weekday/time interpreted, not matched literally (`something for kids tomorrow`)", async () => {
    const tomorrow = parseDateExpression("something for kids tomorrow")
    const start = tomorrow.date_from!
    const end = addHours(start, 2)

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-kids-tomorrow",
        title: "Kids Workshop Club",
        // Omit 'tomorrow' literal token
        description: "Something for kids: build, play and learn.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["family"],
        category: "FAMILY_KIDS",
      }),
      makeEvent({
        id: "melb-kids-not-tomorrow",
        title: "Kids Workshop Club",
        description: "Something for kids: build, play and learn.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(start, 36),
        endAt: addHours(start, 38),
        categories: ["family"],
        category: "FAMILY_KIDS",
      }),
      makeEvent({
        id: "tville-kids-leak",
        title: "Townsville Kids Workshop",
        description: "Something for kids: build, play and learn in Melbourne.",
        city: "Townsville",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["family"],
        category: "FAMILY_KIDS",
      }),
    ]

    const data = await callSearchEvents({
      query: "something for kids tomorrow",
      city: "Melbourne",
      country: "Australia",
    })

    const fromMs = new Date(tomorrow.date_from!).getTime()
    const toMs = new Date(tomorrow.date_to!).getTime()

    expect((data.internal || []).length).toBe(1)
    expect(data.internal[0].city).toBe("Melbourne")
    const st = new Date(data.internal[0].startAt).getTime()
    expect(st).toBeGreaterThanOrEqual(fromMs)
    expect(st).toBeLessThanOrEqual(toMs)
    expect(String(data.internal[0].description || "").toLowerCase()).not.toContain("tomorrow")
  })

  it("weekday parsing: `art friday` is arts (not music)", async () => {
    const friday = parseDateExpression("art friday")
    const start = friday.date_from!
    const end = addHours(start, 2)

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-arts-friday",
        title: "Fitzroy Art Walk",
        description: "Local art exhibitions and gallery tours.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["arts"],
        category: "ARTS_CULTURE",
      }),
      makeEvent({
        id: "melb-arts-other-day",
        title: "Gallery Midweek",
        description: "Local art exhibitions and gallery tours.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(start, 24),
        endAt: addHours(start, 26),
        categories: ["arts"],
        category: "ARTS_CULTURE",
      }),
      makeEvent({
        id: "melb-music-friday",
        title: "Music Set",
        description: "Music with live instruments.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
    ]

    const data = await callSearchEvents({
      query: "art friday",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBeGreaterThan(0)
    expect(data.internal.every((e: any) => e.category === "ARTS_CULTURE")).toBe(true)
  })

  it("weekday parsing: `music next friday` stays music and respects date window", async () => {
    const nextFriday = parseDateExpression("music next friday")
    const start = nextFriday.date_from!
    const end = addHours(start, 2)

    const thisFriday = parseDateExpression("art friday")
    const thisFriStart = thisFriday.date_from!
    const thisFriEnd = addHours(thisFriStart, 2)

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-music-this-friday",
        title: "This Friday Gig",
        description: "Music night with live instruments.",
        city: "Melbourne",
        country: "Australia",
        startAt: thisFriStart,
        endAt: thisFriEnd,
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
      makeEvent({
        id: "melb-music-next-friday",
        title: "Next Friday DJ Set",
        description: "Next DJ set with live music.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
    ]

    const data = await callSearchEvents({
      query: "music next friday",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBe(1)
    const e = data.internal[0]
    expect(e.city).toBe("Melbourne")
    const st = new Date(e.startAt).getTime()
    const fromMs = new Date(nextFriday.date_from!).getTime()
    const toMs = new Date(nextFriday.date_to!).getTime()
    expect(st).toBeGreaterThanOrEqual(fromMs)
    expect(st).toBeLessThanOrEqual(toMs)
  })

  it("category integrity: `food in brunswick` does not drift into music", async () => {
    const future = new Date(FIXED_NOW.getTime() + 6 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "brunswick-food",
        title: "Food Pop-Up",
        description: "Fresh food in Brunswick for the whole family.",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["food"],
        category: "FOOD_DRINK",
      }),
      makeEvent({
        id: "brunswick-music",
        title: "Brunswick Live Set",
        description: "Live music in Brunswick. (Food appears in text.)",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
    ]

    const data = await callSearchEvents({
      query: "food in brunswick",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBeGreaterThan(0)
    expect(data.internal.every((e: any) => e.category === "FOOD_DRINK")).toBe(true)
  })

  it("category integrity: `music in brunswick` does not drift into food", async () => {
    const future = new Date(FIXED_NOW.getTime() + 6 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "brunswick-music",
        title: "Brunswick Live Set",
        description: "Live music in Brunswick with a friendly crowd.",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
      makeEvent({
        id: "brunswick-food",
        title: "Food Pop-Up",
        description: "Fresh food in Brunswick. (Music appears in text.)",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["food"],
        category: "FOOD_DRINK",
      }),
    ]

    const data = await callSearchEvents({
      query: "music in brunswick",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBeGreaterThan(0)
    expect(data.internal.every((e: any) => e.category === "MUSIC_NIGHTLIFE")).toBe(true)
  })

  it("plain-language works: `cheap eats near me` finds the right concept in Melbourne", async () => {
    const future = new Date(FIXED_NOW.getTime() + 10 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-cheap-eats",
        title: "Budget Bites",
        description: "Cheap eats near me in Melbourne. Easy snacks and good vibes.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
      makeEvent({
        id: "tville-should-not-leak",
        title: "Queensland Cheap Eats",
        description: "Cheap eats near me in Melbourne, but actually Townsville.",
        city: "Townsville",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "cheap eats near me",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBe(1)
    expect(data.internal[0].city).toBe("Melbourne")
    expect(String(data.internal[0].description || "").toLowerCase()).toContain("cheap eats near me")
  })

  it("plain-language works: `kids friday` uses date intent and does not require literal `friday` text", async () => {
    const friday = parseDateExpression("kids friday")
    const start = friday.date_from!
    const end = addHours(start, 2)

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-kids-friday",
        title: "Kids Workshop Club",
        description: "Kids workshop for families. Hands-on fun for kids.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["family"],
        category: "FAMILY_KIDS",
      }),
      makeEvent({
        id: "melb-kids-not-friday",
        title: "Kids Workshop Club",
        description: "Kids workshop for families. Hands-on fun for kids.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(start, 26),
        endAt: addHours(start, 28),
        categories: ["family"],
        category: "FAMILY_KIDS",
      }),
    ]

    const data = await callSearchEvents({
      query: "kids friday",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBe(1)
    expect(data.internal[0].city).toBe("Melbourne")
    expect(String(data.internal[0].description || "").toLowerCase()).not.toContain("friday")
  })

  it("fallback safety: category relaxation must not break location truth (Brunswick stays Brunswick)", async () => {
    const future = new Date(FIXED_NOW.getTime() + 7 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "brunswick-food-text-only",
        title: "Budget Bites",
        description: "Cheap food in Brunswick (no category fields provided).",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
      makeEvent({
        id: "townsville-food-text-only",
        title: "Queensland Food Night",
        description: "Cheap food in Brunswick, but located in Townsville (text bait).",
        city: "Townsville",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "food in brunswick",
      city: "Melbourne",
      country: "Australia",
      debug: true,
    })

    // Category-relax retry should happen: strict FOOD_DRINK query (returns 0)
    // then relaxed query without FOOD_DRINK should still keep Brunswick via strict city enforcement.
    expect(findManyWhereHistory.length).toBeGreaterThanOrEqual(2)
    const firstWhere = findManyWhereHistory[0]
    const secondWhere = findManyWhereHistory[1]
    expect(deepIncludesString(firstWhere, "FOOD_DRINK")).toBe(true)
    expect(deepIncludesString(secondWhere, "FOOD_DRINK")).toBe(false)

    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Brunswick")
    expect(internalCities).not.toContain("Townsville")
    expect(data.emptyState).toBe(false)
  })

  it("scope: `things to do` is broad and does not collapse to empty when internal events exist", async () => {
    const future = new Date(FIXED_NOW.getTime() + 8 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-community-broad",
        title: "Neighbourhood Social Night",
        description: "Things to do with locals in Melbourne.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
      makeEvent({
        id: "melb-arts-broad",
        title: "Laneway Gallery Evening",
        description: "What is on around town this week.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(future, 3),
        endAt: addHours(future, 5),
        categories: [],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "things to do",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBeGreaterThan(0)
    expect(data.emptyState).toBe(false)
    // broad scope should not force strict category enum filtering
    expect(findManyWhereHistory.length).toBeGreaterThan(0)
    expect(deepIncludesString(findManyWhereHistory[0], "FOOD_DRINK")).toBe(false)
    expect(deepIncludesString(findManyWhereHistory[0], "MUSIC_NIGHTLIFE")).toBe(false)
  })

  it("scope: `events worldwide` is global and ignores selected UI location restriction", async () => {
    const future = new Date(FIXED_NOW.getTime() + 9 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "global-berlin",
        title: "Berlin Culture Exchange",
        description: "Worldwide events spotlight from Berlin.",
        city: "Berlin",
        country: "Germany",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
      makeEvent({
        id: "global-melbourne",
        title: "Melbourne Community Mixer",
        description: "Worldwide events spotlight from Melbourne.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(future, 4),
        endAt: addHours(future, 6),
        categories: [],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "events worldwide",
      city: "Melbourne",
      country: "Australia",
    })

    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Berlin")
    expect(internalCities).toContain("Melbourne")
    // Ensure no hard location filter from selected city leaked into where clause
    expect(findManyWhereHistory.length).toBeGreaterThan(0)
    expect(deepIncludesString(findManyWhereHistory[0], "\"city\"")).toBe(false)
    expect(deepIncludesString(findManyWhereHistory[0], "Melbourne")).toBe(false)
  })

  it("scope: `festivals Western Europe` preserves region intent and does not fall back to selected local city", async () => {
    const future = new Date(FIXED_NOW.getTime() + 10 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "region-berlin-festival",
        title: "Berlin Street Festival",
        description: "Major festivals across Western Europe.",
        city: "Berlin",
        country: "Germany",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["festival"],
        category: null,
      }),
      makeEvent({
        id: "region-paris-festival",
        title: "Paris Night Festival",
        description: "Major festivals season in Western Europe.",
        city: "Paris",
        country: "France",
        startAt: addHours(future, 3),
        endAt: addHours(future, 5),
        categories: ["festival"],
        category: null,
      }),
      makeEvent({
        id: "region-melbourne-nonmatch",
        title: "Melbourne Local Fair",
        description: "Local community fair in Melbourne suburbs.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(future, 6),
        endAt: addHours(future, 8),
        categories: ["festival"],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "festivals Western Europe",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("query")
    expect(data?.effectiveLocation?.city).toBeNull()
    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Berlin")
    expect(internalCities).toContain("Paris")
    expect(internalCities).not.toContain("Melbourne")
  })

  it("scope/place: `music in Camberwell UK` uses explicit UK context over selected Australia location", async () => {
    const future = new Date(FIXED_NOW.getTime() + 6 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "camberwell-uk-music",
        title: "Camberwell Jazz Night",
        description: "Live music in Camberwell, UK.",
        city: "Camberwell",
        country: "United Kingdom",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
      makeEvent({
        id: "camberwell-au-music",
        title: "Camberwell Australia Music Night",
        description: "Live music in Camberwell, Australia.",
        city: "Camberwell",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
    ]

    const data = await callSearchEvents({
      query: "music in Camberwell UK",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("query")
    expect(data?.effectiveLocation?.city).toBe("Camberwell")
    expect(data?.effectiveLocation?.country).toBe("United Kingdom")
    const internalCountries = (data.internal || []).map((e: any) => e.country)
    expect(internalCountries).toContain("United Kingdom")
    expect(internalCountries).not.toContain("Australia")
  })

  it("no stale state on sequential route calls (request-scoped behavior)", async () => {
    const weekend = parseDateExpression("music this weekend")
    const start = weekend.date_from!
    const end = addHours(start, 2)
    const future = new Date(FIXED_NOW.getTime() + 6 * 86400 * 1000).toISOString()

    // Call 1: music this weekend (Melbourne)
    fixtureInternalEvents = [
      makeEvent({
        id: "call1-melb-music",
        title: "Laneway Vinyl Afternoon",
        description: "Live music on vinyl.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["music"],
        category: "MUSIC_NIGHTLIFE",
      }),
    ]

    const data1 = await callSearchEvents({
      query: "music this weekend",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data1.internal?.length).toBeGreaterThan(0)
    expect(data1.internal?.[0]?.city).toBe("Melbourne")

    // Call 2: food in brunswick (must not reuse music fixtures)
    fixtureInternalEvents = [
      makeEvent({
        id: "call2-brunswick-food",
        title: "Food Pop-Up",
        description: "Fresh food in Brunswick.",
        city: "Brunswick",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["food"],
        category: "FOOD_DRINK",
      }),
    ]

    const data2 = await callSearchEvents({
      query: "food in brunswick",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data2.internal?.length).toBeGreaterThan(0)
    expect(data2.internal?.[0]?.city).toBe("Brunswick")
  })
})

