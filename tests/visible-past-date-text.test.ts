/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest"
import {
  evaluateVisiblePastDateStale,
  visibleTextHasExplicitFutureCalendarEnd,
} from "@/lib/search/visible-past-date-text"

const NOW = new Date("2026-03-18T10:00:00.000Z")

describe("evaluateVisiblePastDateStale", () => {
  it("drops month+year before now", () => {
    expect(evaluateVisiblePastDateStale("festival january 2026 echuca", NOW).kind).toBe("drop")
  })

  it("keeps month+year still in progress (march 2026 when now is mid-march)", () => {
    expect(evaluateVisiblePastDateStale("lineup march 2026", NOW).kind).toBe("ok")
  })

  it("keeps explicit day in the future", () => {
    expect(evaluateVisiblePastDateStale("gig 20 march 2026", NOW).kind).toBe("ok")
  })

  it("keeps ISO date in the future", () => {
    expect(evaluateVisiblePastDateStale("gates open 2026-04-20 early", NOW).kind).toBe("ok")
  })

  it("drops ISO date in the past", () => {
    expect(evaluateVisiblePastDateStale("updated 2026-01-25 release", NOW).kind).toBe("drop")
  })

  it("penalizes ambiguous numeric date when both parts <= 12", () => {
    expect(evaluateVisiblePastDateStale("doors 06/05/2027 open", NOW).kind).toBe("penalize")
  })
})

describe("visibleTextHasExplicitFutureCalendarEnd", () => {
  it("is true when an explicit calendar end is on or after now", () => {
    expect(visibleTextHasExplicitFutureCalendarEnd("tickets 2026-04-20 echuca", NOW)).toBe(true)
  })

  it("is false when only a past explicit date is present", () => {
    expect(visibleTextHasExplicitFutureCalendarEnd("recap from january 2026", NOW)).toBe(false)
  })

  it("is false when there is no parseable calendar phrase", () => {
    expect(visibleTextHasExplicitFutureCalendarEnd("what's on echuca", NOW)).toBe(false)
  })
})
