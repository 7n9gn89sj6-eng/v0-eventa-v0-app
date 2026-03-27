import { describe, it, expect, vi, afterEach } from "vitest"
import { dateRangeOverlapSearchStart } from "@/lib/search/date-overlap"
import { parseDateExpression } from "@/lib/search/query-parser"

describe("dateRangeOverlapSearchStart", () => {
  it("keeps parsed weekend start for this_weekend when now is mid–Saturday (no clamp to now)", () => {
    const from = new Date("2026-03-21T00:00:00.000Z")
    const midSaturday = new Date("2026-03-21T14:00:00.000Z")
    expect(dateRangeOverlapSearchStart(from, midSaturday, "this_weekend")).toEqual(from)
  })

  it("keeps parsed start for next_weekend when window start is in the past vs clock", () => {
    const from = new Date("2026-03-28T00:00:00.000Z")
    const midSun = new Date("2026-03-29T12:00:00.000Z")
    expect(dateRangeOverlapSearchStart(from, midSun, "next_weekend")).toEqual(from)
  })

  it("still clamps non-weekend ranges when dateFrom is in the past", () => {
    const from = new Date("2026-03-01T00:00:00.000Z")
    const now = new Date("2026-03-18T10:00:00.000Z")
    expect(dateRangeOverlapSearchStart(from, now, "month")).toEqual(now)
    expect(dateRangeOverlapSearchStart(from, now, "explicit_range")).toEqual(now)
    expect(dateRangeOverlapSearchStart(from, now, undefined)).toEqual(now)
  })

  it("does not clamp when dateFrom is in the future (any window type)", () => {
    const from = new Date("2026-12-01T00:00:00.000Z")
    const now = new Date("2026-03-18T10:00:00.000Z")
    expect(dateRangeOverlapSearchStart(from, now, "month")).toEqual(from)
  })
})

describe("this weekend + overlap start (integration)", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("parseDateExpression still yields Sat–Sun; overlap helper preserves start mid-weekend", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-21T15:30:00.000Z")) // Saturday 15:30 UTC
    const parsed = parseDateExpression("events in Sydney this weekend")
    expect(parsed.relativeWindowType).toBe("this_weekend")
    expect(parsed.date_from).toBeTruthy()
    expect(parsed.date_to).toBeTruthy()
    const from = new Date(parsed.date_from!)
    const to = new Date(parsed.date_to!)
    const now = new Date()
    const searchStart = dateRangeOverlapSearchStart(from, now, parsed.relativeWindowType)
    expect(searchStart.getTime()).toBe(from.getTime())
    expect(to.getTime()).toBeGreaterThan(from.getTime())
  })
})
