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

/** Default: no stored parent sample (ambient falls back to minimal map). */
const prismaFindFirst = vi.fn(async () => null)

const searchWeb = vi.fn(async () => fixtureWebResults)

vi.mock("@/lib/db", () => {
  return {
    default: {
      event: {
        findMany: prismaFindMany,
        count: prismaCount,
        findFirst: prismaFindFirst,
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
    prismaFindFirst.mockClear()
    prismaFindFirst.mockResolvedValue(null)
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
    category?: string
    debug?: boolean
    date_from?: string
    date_to?: string
  }) {
    const url = new URL("http://localhost/api/search/events")
    url.searchParams.set("query", opts.query)
    if (opts.city) url.searchParams.set("city", opts.city)
    if (opts.country) url.searchParams.set("country", opts.country)
    if (opts.category) url.searchParams.set("category", opts.category)
    if (opts.debug) url.searchParams.set("debug", "1")
    if (opts.date_from) url.searchParams.set("date_from", opts.date_from)
    if (opts.date_to) url.searchParams.set("date_to", opts.date_to)

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
        category: "MARKETS",
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
        category: "MARKETS",
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

    expect(data).toHaveProperty("phase1Interpretation")
    expect(data.phase1Interpretation).toMatchObject({
      schemaVersion: 1,
      meta: expect.objectContaining({ aiAttempted: true }),
    })
  })

  it("URL category steers ranking when query text has no category keyword (broad scope)", async () => {
    const future = new Date(FIXED_NOW.getTime() + 3 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "evt-music-quality",
        title: "Club events — live jazz evening",
        description:
          "An extended evening of live jazz with local artists and guest performers at the venue.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 3),
        categories: ["music"],
        category: "MUSIC",
      }),
      makeEvent({
        id: "evt-markets-thin",
        title: "Weekend market events",
        description: "Stalls.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["markets"],
        category: "MARKETS",
      }),
    ]

    // Broad scope → strict category filter off, but category=markets is still a ranking signal.
    const withCategory = await callSearchEvents({
      query: "events this weekend",
      city: "Melbourne",
      country: "Australia",
      category: "markets",
    })

    expect(withCategory.internal?.[0]?.id).toBe("evt-markets-thin")

    const noCategory = await callSearchEvents({
      query: "events this weekend",
      city: "Melbourne",
      country: "Australia",
    })

    expect(noCategory.internal?.[0]?.id).toBe("evt-music-quality")
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
        category: "MUSIC",
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

  it("ambient suburb: UI Brunswick + `music` broadens to Melbourne when suburb is empty", async () => {
    const future = new Date(FIXED_NOW.getTime() + 6 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-music-ambient",
        title: "Northside Jazz",
        description: "Live music in the CBD.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music",
      city: "Brunswick",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("ui")
    expect(data?.effectiveLocation?.city).toBe("Melbourne")
    expect((data.internal || []).map((e: any) => e.city)).toContain("Melbourne")
    expect(findManyWhereHistory.length).toBeGreaterThanOrEqual(2)
  })

  it("ambient suburb: UI Brunswick + `music this weekend` broadens when suburb is empty", async () => {
    const weekend = parseDateExpression("music this weekend")
    expect(weekend.date_from).toBeTruthy()
    const start = weekend.date_from!
    const end = addHours(start, 4)

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-music-weekend-ambient",
        title: "Weekend Sessions",
        description: "DJ sets and live music — local acts.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music this weekend",
      city: "Brunswick",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("ui")
    expect(data?.effectiveLocation?.city).toBe("Melbourne")
    expect((data.internal || []).map((e: any) => e.city)).toContain("Melbourne")
    expect(findManyWhereHistory.length).toBeGreaterThanOrEqual(2)
  })

  it("ambient suburb: UI Brunswick + `Music near me` exposes Melbourne in effectiveLocation after widening", async () => {
    const future = new Date(FIXED_NOW.getTime() + 6 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-music-near-me",
        title: "CBD Jazz Night",
        description: "Live music near the river — jazz and more.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "Music near me",
      city: "Brunswick",
      country: "Australia",
      category: "music",
    })

    expect(data?.effectiveLocation?.source).toBe("ui")
    expect(data?.effectiveLocation?.city).toBe("Melbourne")
    expect((data.internal || []).map((e: any) => e.city)).toContain("Melbourne")
    expect(findManyWhereHistory.length).toBeGreaterThanOrEqual(2)
  })

  it("UI Melbourne retrieves suburb events via stored event.parentCity", async () => {
    const future = new Date(FIXED_NOW.getTime() + 7 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "brunswick-parent-melb",
        title: "Westside Jazz Music Night",
        description: "Live music in the inner north.",
        city: "Brunswick",
        parentCity: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("ui")
    expect(data?.effectiveLocation?.city).toBe("Melbourne")
    expect((data.internal || []).map((e: any) => e.city)).toContain("Brunswick")
  })

  it("ambient thin internal uses findFirst parentCity before hardcoded suburb map", async () => {
    const future = new Date(FIXED_NOW.getTime() + 6 * 86400 * 1000).toISOString()
    prismaFindFirst.mockResolvedValueOnce({ parentCity: "Melbourne" })

    fixtureInternalEvents = [
      makeEvent({
        id: "melb-cbd-from-richmond-ambient",
        title: "CBD Jazz",
        description: "Live music downtown.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music",
      city: "Richmond",
      country: "Australia",
    })

    expect(prismaFindFirst).toHaveBeenCalled()
    expect(data?.effectiveLocation?.city).toBe("Melbourne")
    expect((data.internal || []).map((e: any) => e.city)).toContain("Melbourne")
  })

  it("explicit query `music Berlin` stays Berlin-only with UI Brunswick", async () => {
    const future = new Date(FIXED_NOW.getTime() + 7 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "berlin-music-explicit",
        title: "Kreuzberg Live",
        description: "Electronic music night.",
        city: "Berlin",
        country: "Germany",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
      makeEvent({
        id: "melb-music-leak",
        title: "Fed Square Gig",
        description: "Outdoor music.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music Berlin",
      city: "Brunswick",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("query")
    expect(data?.effectiveLocation?.city).toBe("Berlin")
    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Berlin")
    expect(internalCities).not.toContain("Melbourne")
  })

  it("global `music festivals anywhere` does not apply suburb parent expansion", async () => {
    const future = new Date(FIXED_NOW.getTime() + 8 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "fest-melb-global",
        title: "Melbourne Winter Music Festival",
        description: "Music festivals showcase.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["festival", "music"],
        category: "MUSIC",
      }),
      makeEvent({
        id: "fest-berlin-global",
        title: "Berlin Open Air",
        description: "International music festival.",
        city: "Berlin",
        country: "Germany",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["festival", "music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music festivals anywhere",
      city: "Brunswick",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.scope).toBe("global")
    expect(data?.effectiveLocation?.city).toBeNull()
    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Melbourne")
    expect(internalCities).toContain("Berlin")
    expect(findManyWhereHistory.length).toBe(1)
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
        category: "MUSIC",
      }),
      makeEvent({
        id: "melb-music-weekend-weaker",
        title: "Community Social",
        description: "A friendly social meetup in Melbourne with quiet background music.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: end,
        categories: ["music"],
        category: "MUSIC",
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
        category: "MUSIC",
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
        category: "MUSIC",
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

    expect((data.internal || []).length).toBeGreaterThanOrEqual(2)
    expect(data.internal[0].id).toBe("melb-music-weekend")

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
        category: "FAMILY",
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
        category: "FAMILY",
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
        category: "FAMILY",
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
        category: "ART",
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
        category: "ART",
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
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "art friday",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data.internal?.length).toBeGreaterThan(0)
    expect(data.internal.every((e: any) => e.category === "ART")).toBe(true)
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
        category: "MUSIC",
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
        category: "MUSIC",
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
        category: "MUSIC",
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
        category: "MUSIC",
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
    expect(data.internal.every((e: any) => e.category === "MUSIC")).toBe(true)
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
        category: "FAMILY",
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
        category: "FAMILY",
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
    expect(deepIncludesString(findManyWhereHistory[0], "MUSIC")).toBe(false)

    expect(data.internal[0].city).toBe("Melbourne")
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

    expect(data?.effectiveLocation?.scope).toBe("global")
    expect(data?.effectiveLocation?.city).toBeNull()
    expect(data?.effectiveLocation?.country).toBeNull()

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
    expect(data?.effectiveLocation?.scope).toBe("region")
    expect(data?.effectiveLocation?.city).toBeNull()
    expect(data?.effectiveLocation?.countries).toEqual(
      expect.arrayContaining(["Germany", "France", "Netherlands", "Belgium", "Luxembourg"]),
    )
    expect(findManyWhereHistory.length).toBeGreaterThan(0)
    expect(deepIncludesString(findManyWhereHistory[0], "Melbourne")).toBe(false)
    const internalCities = (data.internal || []).map((e: any) => e.city)
    expect(internalCities).toContain("Berlin")
    expect(internalCities).toContain("Paris")
    expect(internalCities).not.toContain("Melbourne")

    expect(data.internal.some((e: any) => e.city === "Berlin")).toBe(true)
    expect(data.internal.some((e: any) => e.city === "Paris")).toBe(true)
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
        category: "MUSIC",
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
        category: "MUSIC",
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

  it("trust batch: `what's on this weekend` is broad + weekend window (Melbourne UI)", async () => {
    const weekend = parseDateExpression("what's on this weekend")
    const start = weekend.date_from!
    const end = weekend.date_to!

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-weekend-melb",
        title: "What's On: Laneway Social",
        description: "What's on in the neighbourhood this weekend.",
        city: "Melbourne",
        country: "Australia",
        startAt: start,
        endAt: addHours(start, 3),
        categories: [],
        category: null,
      }),
      makeEvent({
        id: "trust-weekend-melb-later",
        title: "Sunday Park Meetup",
        description: "Casual meetup — see what's on nearby.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(end, -4),
        endAt: end,
        categories: [],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "what's on this weekend",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.scope).toBe("broad")
    expect(data.internal?.length).toBeGreaterThan(0)
    expect(data.emptyState).toBe(false)
    expect(findManyWhereHistory.length).toBeGreaterThan(0)
    expect(deepIncludesString(findManyWhereHistory[0], "MUSIC")).toBe(false)
    expect((data.internal || []).every((e: any) => e.city === "Melbourne")).toBe(true)
  })

  it("trust batch: `live music tonight` keeps Melbourne + music + tonight window", async () => {
    const range = parseDateExpression("live music tonight")
    const start = range.date_from!
    const end = range.date_to!

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-tonight-music",
        title: "Live music at the Corner",
        description: "Bands tonight in Melbourne.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(start, 1),
        endAt: addHours(start, 3),
        categories: ["music"],
        category: "MUSIC",
      }),
      makeEvent({
        id: "trust-afternoon-music",
        title: "Afternoon acoustic set",
        description: "Live music earlier today.",
        city: "Melbourne",
        country: "Australia",
        startAt: new Date(FIXED_NOW.getTime() + 9 * 86400 * 1000).toISOString(),
        endAt: new Date(FIXED_NOW.getTime() + 9 * 86400 * 1000 + 2 * 3600 * 1000).toISOString(),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "live music tonight",
      city: "Melbourne",
      country: "Australia",
    })

    const titles = (data.internal || []).map((e: any) => e.title)
    expect(titles.some((t: string) => t.includes("Corner"))).toBe(true)
    expect(titles.some((t: string) => t.includes("Afternoon"))).toBe(false)
    expect(deepIncludesString(findManyWhereHistory[0], "MUSIC")).toBe(true)
  })

  it("trust batch: `comedy tomorrow` targets tomorrow + comedy category signal", async () => {
    const range = parseDateExpression("comedy tomorrow")
    const dayStart = range.date_from!
    const dayEnd = range.date_to!

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-comedy-tomorrow",
        title: "Stand-up at the Club",
        description: "Comedy showcase tomorrow night.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(dayStart, 10),
        endAt: addHours(dayStart, 12),
        categories: ["comedy"],
        category: "COMMUNITY",
      }),
      makeEvent({
        id: "trust-music-tomorrow",
        title: "DJ Night",
        description: "Electronic music tomorrow.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(dayStart, 14),
        endAt: addHours(dayStart, 16),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "comedy tomorrow",
      city: "Melbourne",
      country: "Australia",
    })

    const titles = (data.internal || []).map((e: any) => e.title)
    expect(titles.some((t: string) => t.includes("Stand-up"))).toBe(true)
    expect(titles.some((t: string) => t.includes("DJ Night"))).toBe(false)
  })

  it("trust batch: `garage sale Saturday` uses markets intent + Saturday window", async () => {
    const range = parseDateExpression("garage sale saturday")
    const dayStart = range.date_from!
    const dayEnd = range.date_to!

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-garage-sat",
        title: "Neighbourhood garage sale",
        description: "Household goods and books Saturday.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(dayStart, 2),
        endAt: addHours(dayStart, 5),
        categories: ["markets"],
        category: "MARKETS",
      }),
      makeEvent({
        id: "trust-garage-sun",
        title: "Sunday market stall",
        description: "Garage sale style tables Sunday only.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(dayEnd, 4),
        endAt: addHours(dayEnd, 8),
        categories: ["markets"],
        category: "MARKETS",
      }),
    ]

    const data = await callSearchEvents({
      query: "garage sale Saturday",
      city: "Melbourne",
      country: "Australia",
    })

    const titles = (data.internal || []).map((e: any) => e.title)
    expect(titles.some((t: string) => t.includes("garage sale"))).toBe(true)
    expect(titles.some((t: string) => t.includes("Sunday"))).toBe(false)
    expect(deepIncludesString(findManyWhereHistory[0], "MARKETS")).toBe(true)
  })

  it("trust batch: `live music Melbourne` overrides UI city (Sydney selected)", async () => {
    const future = new Date(FIXED_NOW.getTime() + 5 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-melb-music",
        title: "Melbourne live music hall",
        description: "Gigs in Melbourne CBD.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
      makeEvent({
        id: "trust-sydney-music",
        title: "Sydney harbour jazz",
        description: "Live music by the water.",
        city: "Sydney",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "live music Melbourne",
      city: "Sydney",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.source).toBe("query")
    expect(data?.effectiveLocation?.city).toBe("Melbourne")
    const cities = (data.internal || []).map((e: any) => e.city)
    expect(cities).toContain("Melbourne")
    expect(cities).not.toContain("Sydney")
  })

  it("trust batch: `book fair Athens` overrides UI + matches Athens / markets", async () => {
    const future = new Date(FIXED_NOW.getTime() + 7 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-athens-book",
        title: "Athens international book fair",
        description: "Publishers and readers in Athens.",
        city: "Athens",
        country: "Greece",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["fair", "markets"],
        category: "MARKETS",
      }),
      makeEvent({
        id: "trust-berlin-book",
        title: "Berlin book weekend",
        description: "Book fair stalls in Berlin.",
        city: "Berlin",
        country: "Germany",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["markets"],
        category: "MARKETS",
      }),
    ]

    const data = await callSearchEvents({
      query: "book fair Athens",
      city: "Berlin",
      country: "Germany",
    })

    expect(data?.effectiveLocation?.source).toBe("query")
    expect(data?.effectiveLocation?.city).toBe("Athens")
    const cities = (data.internal || []).map((e: any) => e.city)
    expect(cities).toContain("Athens")
    expect(cities).not.toContain("Berlin")
  })

  it("trust batch: `music Southern Europe` is region-scoped (not UI Melbourne)", async () => {
    const future = new Date(FIXED_NOW.getTime() + 8 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-rome-music",
        title: "Rome live music night",
        description: "Southern Europe tour stop — live music in Rome.",
        city: "Rome",
        country: "Italy",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
      makeEvent({
        id: "trust-melb-music-south",
        title: "Melbourne jazz club",
        description: "Live music downtown.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music Southern Europe",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.scope).toBe("region")
    expect(data?.effectiveLocation?.region).toBe("Southern Europe")
    expect(findManyWhereHistory.length).toBeGreaterThan(0)
    expect(deepIncludesString(findManyWhereHistory[0], "Melbourne")).toBe(false)
    const countries = (data.internal || []).map((e: any) => e.country)
    expect(countries).toContain("Italy")
    expect(countries).not.toContain("Australia")
  })

  it("trust batch: `art events Northern Europe` is region-scoped + art signal", async () => {
    const future = new Date(FIXED_NOW.getTime() + 9 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-stockholm-art",
        title: "Nordic art events weekend",
        description: "Contemporary art events across Northern Europe.",
        city: "Stockholm",
        country: "Sweden",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["art", "exhibition"],
        category: "ART",
      }),
      makeEvent({
        id: "trust-melb-art-north",
        title: "Melbourne gallery night",
        description: "Art events in the laneways.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["art"],
        category: "ART",
      }),
    ]

    const data = await callSearchEvents({
      query: "art events Northern Europe",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.scope).toBe("region")
    expect(data?.effectiveLocation?.region).toBe("Northern Europe")
    expect(deepIncludesString(findManyWhereHistory[0], "Melbourne")).toBe(false)
    const cities = (data.internal || []).map((e: any) => e.city)
    expect(cities).toContain("Stockholm")
    expect(cities).not.toContain("Melbourne")
  })

  it("trust batch: `events Eastern Europe` is region-scoped without UI city leak", async () => {
    const future = new Date(FIXED_NOW.getTime() + 11 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-warsaw-events",
        title: "Warsaw community night",
        description: "Local community events across Eastern Europe.",
        city: "Warsaw",
        country: "Poland",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
      makeEvent({
        id: "trust-melb-events-ee",
        title: "Melbourne trivia",
        description: "Weekly events in Melbourne.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 2),
        categories: [],
        category: null,
      }),
    ]

    const data = await callSearchEvents({
      query: "events Eastern Europe",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.scope).toBe("region")
    expect(data?.effectiveLocation?.region).toBe("Eastern Europe")
    expect(deepIncludesString(findManyWhereHistory[0], "Melbourne")).toBe(false)
    const countries = (data.internal || []).map((e: any) => e.country)
    expect(countries).toContain("Poland")
    expect(countries).not.toContain("Australia")
  })

  it("trust batch: `music festivals anywhere` is global and returns multiple countries", async () => {
    const future = new Date(FIXED_NOW.getTime() + 12 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "trust-fest-berlin",
        title: "Berlin open-air music festival",
        description: "Music festivals in the park.",
        city: "Berlin",
        country: "Germany",
        startAt: future,
        endAt: addHours(future, 2),
        categories: ["festival", "music"],
        category: "MUSIC",
      }),
      makeEvent({
        id: "trust-fest-melb",
        title: "Melbourne summer music festival",
        description: "Outdoor music festival weekend.",
        city: "Melbourne",
        country: "Australia",
        startAt: addHours(future, 3),
        endAt: addHours(future, 5),
        categories: ["festival", "music"],
        category: "MUSIC",
      }),
    ]

    const data = await callSearchEvents({
      query: "music festivals anywhere",
      city: "Melbourne",
      country: "Australia",
    })

    expect(data?.effectiveLocation?.scope).toBe("global")
    expect(data?.effectiveLocation?.city).toBeNull()
    expect(findManyWhereHistory.length).toBeGreaterThan(0)
    expect(deepIncludesString(findManyWhereHistory[0], "Melbourne")).toBe(false)
    const countries = new Set((data.internal || []).map((e: any) => e.country))
    expect(countries.has("Germany")).toBe(true)
    expect(countries.has("Australia")).toBe(true)
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
        category: "MUSIC",
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

  it("named-event query: suppresses web cards that duplicate internal official host (MICF + comedyfestival.com.au)", async () => {
    const future = new Date(FIXED_NOW.getTime() + 14 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "micf-internal",
        title: "Melbourne International Comedy Festival 2026",
        description: "Official comedy festival season in Melbourne.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 6),
        categories: ["comedy"],
        category: "COMEDY",
        externalUrl: "https://www.comedyfestival.com.au/",
      }),
    ]

    fixtureWebResults = [
      {
        source: "web",
        title: "Melbourne International Comedy Festival — browse shows",
        snippet: "Official festival program and tickets.",
        url: "https://comedyfestival.com.au/browse-shows",
        startAt: future,
      },
      {
        source: "web",
        title: "MICF — home",
        snippet: "Melbourne comedy festival official site.",
        url: "https://www.comedyfestival.com.au/",
        startAt: future,
      },
      {
        source: "web",
        title: "MICF preview article",
        snippet: "What to see at the festival this year.",
        url: "https://news.example.com/melbourne-comedy-festival-preview",
        startAt: future,
      },
    ]

    const data = await callSearchEvents({
      query: "Melbourne International Comedy Festival",
      city: "Melbourne",
      country: "Australia",
    })

    const comedyHostWeb = (data.external || []).filter((e: any) =>
      String(e.externalUrl || "").includes("comedyfestival.com.au"),
    )
    expect(comedyHostWeb.length).toBe(0)
    expect((data.internal || []).length).toBeGreaterThan(0)
    expect((data.events || []).some((e: any) => e.source === "internal")).toBe(true)
    expect((data.external || []).some((e: any) => String(e.externalUrl || "").includes("news.example.com"))).toBe(
      true,
    )
  })

  it("broad discovery query: does not apply same-host web suppression", async () => {
    const future = new Date(FIXED_NOW.getTime() + 14 * 86400 * 1000).toISOString()

    fixtureInternalEvents = [
      makeEvent({
        id: "micf-internal",
        title: "Melbourne International Comedy Festival 2026",
        description: "Official comedy festival season in Melbourne.",
        city: "Melbourne",
        country: "Australia",
        startAt: future,
        endAt: addHours(future, 6),
        categories: ["comedy"],
        category: "COMEDY",
        externalUrl: "https://www.comedyfestival.com.au/",
      }),
    ]

    fixtureWebResults = [
      {
        source: "web",
        title: "Festival browse",
        snippet: "Shows and tickets in Melbourne.",
        url: "https://comedyfestival.com.au/browse-shows",
        startAt: future,
      },
      {
        source: "web",
        title: "Festival what's on",
        snippet: "Official Melbourne comedy festival calendar.",
        url: "https://www.comedyfestival.com.au/whats-on",
        startAt: future,
      },
    ]

    const data = await callSearchEvents({
      query: "events in Melbourne",
      city: "Melbourne",
      country: "Australia",
    })

    const comedyHostWeb = (data.external || []).filter((e: any) =>
      String(e.externalUrl || "").includes("comedyfestival.com.au"),
    )
    expect(comedyHostWeb.length).toBe(2)
  })

  it("web trust: drops unambiguous stale visible year (snippet 2024, no startAt) in default discovery", async () => {
    fixtureInternalEvents = []
    fixtureWebResults = [
      {
        source: "web",
        title: "Old season wrap-up",
        snippet: "Festival highlights and photos from 2024.",
        url: "https://example.com/old-season-2024",
      },
    ]

    const data = await callSearchEvents({
      query: "music festivals",
      city: "Melbourne",
      country: "Australia",
    })

    expect((data.external || []).some((e: any) => e.externalUrl === "https://example.com/old-season-2024")).toBe(
      false,
    )
  })

  it("web trust: weak visible last-year signal is kept but strongly penalised in ranking (debug)", async () => {
    fixtureInternalEvents = []
    fixtureWebResults = [
      {
        source: "web",
        title: "Courtyard night market Melbourne",
        snippet: "Saturday night market — part of our popular 2025 season in the square.",
        url: "https://example.com/night-market-2025",
      },
    ]

    const data = await callSearchEvents({
      query: "music festivals",
      city: "Melbourne",
      country: "Australia",
      debug: true,
    })

    expect((data.external || []).some((e: any) => e.externalUrl === "https://example.com/night-market-2025")).toBe(
      true,
    )
    const ranked = (data.debugTrace?.rankingUnifiedTop15 || []).find(
      (r: any) => r.url === "https://example.com/night-market-2025",
    )
    expect(ranked?._rankBreakdown?.mismatchPenalty ?? 0).toBeGreaterThanOrEqual(34)
  })

  it("web trust: history/archive query skips aggressive visible-year drop", async () => {
    fixtureInternalEvents = []
    fixtureWebResults = [
      {
        source: "web",
        title: "Archive programme",
        snippet: "Season recap from 2024 and past performers.",
        url: "https://example.com/archive-2024",
      },
    ]

    const data = await callSearchEvents({
      query: "historical archive comedy shows",
      city: "Melbourne",
      country: "Australia",
    })

    expect((data.external || []).some((e: any) => e.externalUrl === "https://example.com/archive-2024")).toBe(true)
  })

  it("web trust: drops visible month+year clearly before now when no startAt", async () => {
    fixtureInternalEvents = []
    fixtureWebResults = [
      {
        source: "web",
        title: "Echuca Riverboats",
        snippet: "Festival weekend january 2026 at the port.",
        url: "https://example.com/echuca-boats-jan",
      },
    ]

    const data = await callSearchEvents({
      query: "what on in Echuca",
      city: "Echuca",
      country: "Australia",
    })

    expect((data.external || []).some((e: any) => e.externalUrl === "https://example.com/echuca-boats-jan")).toBe(
      false,
    )
  })

  it("web trust: keeps future explicit visible date in snippet when no startAt", async () => {
    fixtureInternalEvents = []
    fixtureWebResults = [
      {
        source: "web",
        title: "Echuca Field Day",
        snippet: "Tickets — event date 2026-04-20. Live music and food.",
        url: "https://example.com/echuca-future-march",
      },
    ]

    const data = await callSearchEvents({
      query: "what on in Echuca",
      city: "Echuca",
      country: "Australia",
    })

    expect((data.external || []).some((e: any) => e.externalUrl === "https://example.com/echuca-future-march")).toBe(
      true,
    )
  })

  it("web trust: history intent keeps past visible month+year in snippet", async () => {
    fixtureInternalEvents = []
    fixtureWebResults = [
      {
        source: "web",
        title: "Old season recap",
        snippet: "Highlights from january 2026.",
        url: "https://example.com/echuca-archive-jan",
      },
    ]

    const data = await callSearchEvents({
      query: "historical archive events echuca",
      city: "Echuca",
      country: "Australia",
    })

    expect((data.external || []).some((e: any) => e.externalUrl === "https://example.com/echuca-archive-jan")).toBe(
      true,
    )
  })

  it("web trust: ambiguous d/m slash gets penalty not drop when still potentially future", async () => {
    fixtureInternalEvents = []
    fixtureWebResults = [
      {
        source: "web",
        title: "Summer fair",
        snippet: "Gates open 06/07/2026 early.",
        url: "https://example.com/ambiguous-slash",
      },
    ]

    const data = await callSearchEvents({
      query: "what on in Echuca",
      city: "Echuca",
      country: "Australia",
      debug: true,
    })

    expect((data.external || []).some((e: any) => e.externalUrl === "https://example.com/ambiguous-slash")).toBe(
      true,
    )
    const ranked = (data.debugTrace?.rankingUnifiedTop15 || []).find(
      (r: any) => r.url === "https://example.com/ambiguous-slash",
    )
    expect(ranked?._rankBreakdown?.mismatchPenalty ?? 0).toBeGreaterThanOrEqual(42)
  })
})

