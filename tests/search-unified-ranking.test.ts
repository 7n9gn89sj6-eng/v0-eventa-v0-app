import { describe, expect, it } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { genericWebListingPenalty, scoreSearchResult } from "@/lib/search/score-search-result"

const NOW = new Date("2026-03-18T12:00:00.000Z")

describe("unified search ranking (deterministic)", () => {
  it("relevant internal event outscores generic external listing in same city (music intent)", () => {
    const q = "live music Melbourne"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 5 * 86400 * 1000).toISOString()

    const internalRow = {
      title: "Northside Jazz Quartet",
      description: "Live jazz at the local hall.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["music"],
      category: "MUSIC",
    }
    const genericWeb = {
      title: "What's On Melbourne",
      description: "Browse all upcoming events and calendars in Melbourne.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["music"],
      externalUrl: "https://visit.example.com/whats-on/melbourne",
      _originalUrl: "https://visit.example.com/whats-on/melbourne",
      _originalSnippet: "Browse all upcoming events and calendars in Melbourne.",
    }

    const internal = scoreSearchResult({
      result: internalRow,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "music",
    })!
    const web = scoreSearchResult({
      result: genericWeb,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "web",
      rankingCategory: "music",
      webListingBoost: 0,
    })!

    expect(internal.total).toBeGreaterThan(web.total)
    expect(web.genericWebPenalty).toBeGreaterThan(0)
  })

  it("internal with strong category + date alignment ranks above broader web calendar page", () => {
    const q = "food market melbourne"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 3 * 86400 * 1000).toISOString()

    const internalRow = {
      title: "Southbank Farmers Market",
      description: "Fresh produce and street food.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["food", "markets"],
      category: "MARKETS",
    }
    const webCalendar = {
      title: "Melbourne Events Calendar",
      description: "Event calendar listing for the whole city.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      externalUrl: "https://events.example.com/melbourne/events",
      _originalUrl: "https://events.example.com/melbourne/events",
    }

    const internal = scoreSearchResult({
      result: internalRow,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "internal",
      rankingCategory: "markets",
    })!
    const web = scoreSearchResult({
      result: webCalendar,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "web",
      rankingCategory: "markets",
      webListingBoost: -4,
    })!

    expect(internal.total).toBeGreaterThan(web.total)
  })

  it("drops web row when city does not match structured execution city", () => {
    const q = "concerts"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 4 * 86400 * 1000).toISOString()

    const sydneyWeb = {
      title: "Opera House Concert",
      description: "Classical night in Sydney.",
      city: "Sydney",
      country: "Australia",
      startAt: future,
      endAt: future,
      externalUrl: "https://example.com/sydney",
      _originalUrl: "https://example.com/sydney",
    }

    expect(
      scoreSearchResult({
        result: sydneyWeb,
        intent,
        searchPlan: plan,
        now: NOW,
        kind: "web",
        rankingCategory: "music",
      }),
    ).toBeNull()
  })

  it("strong specific web page outranks generic web hub for the same query (no AI)", () => {
    const q = "underground techno Melbourne"
    const intent = parseSearchIntent(q)
    const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
    const future = new Date(NOW.getTime() + 2 * 86400 * 1000).toISOString()

    const genericWeb = {
      title: "What's On Melbourne",
      description: "Browse every event listing in Melbourne.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      externalUrl: "https://visit.example.com/whats-on/melbourne",
      _originalUrl: "https://visit.example.com/whats-on/melbourne",
    }
    const strongWeb = {
      title: "Underground Techno Warehouse Night Melbourne",
      description: "Techno DJs all night — Melbourne CBD.",
      city: "Melbourne",
      country: "Australia",
      startAt: future,
      endAt: future,
      categories: ["music"],
      externalUrl: "https://club.example.com/techno-melbourne",
      _originalUrl: "https://club.example.com/techno-melbourne",
    }

    const gw = scoreSearchResult({
      result: genericWeb,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "web",
      rankingCategory: "music",
      webListingBoost: 0,
    })!
    const sw = scoreSearchResult({
      result: strongWeb,
      intent,
      searchPlan: plan,
      now: NOW,
      kind: "web",
      rankingCategory: "music",
      webListingBoost: 0,
    })!

    expect(sw.total).toBeGreaterThan(gw.total)
    expect(genericWebListingPenalty(strongWeb)).toBe(0)
    expect(gw.genericWebPenalty).toBeGreaterThan(0)
  })
})
