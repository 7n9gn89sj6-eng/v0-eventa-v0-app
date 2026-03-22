import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { parseDateExpression } from "@/lib/search/query-parser"

describe("Eventa trust: parseDateExpression time intent", () => {
  // Fixed reference date:
  // 2026-03-18 is a Wednesday (CI-local timezone may differ).
  // We assert via day-of-week + ISO date parts, not by absolute timestamps.
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-18T10:00:00.000Z"))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it("interprets `this weekend` as Sat..Sun", () => {
    const res = parseDateExpression("this weekend")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()

    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getDay()).toBe(6) // Saturday
    expect(to.getDay()).toBe(0) // Sunday
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime())
  })

  it("interprets `tomorrow` as the next day (end-of-day same date)", () => {
    const res = parseDateExpression("something for kids tomorrow")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()

    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    // `toISOString()` can shift by a day due to local timezone offsets.
    // Assert on *local calendar* dates instead of ISO day boundaries.
    const base = new Date("2026-03-18T10:00:00.000Z")
    base.setHours(0, 0, 0, 0)
    const expectedTomorrow = new Date(base)
    expectedTomorrow.setDate(base.getDate() + 1)

    const sameLocalDay = (d: Date, expected: Date) =>
      d.getFullYear() === expected.getFullYear() &&
      d.getMonth() === expected.getMonth() &&
      d.getDate() === expected.getDate()

    expect(sameLocalDay(from, expectedTomorrow)).toBe(true)
    expect(sameLocalDay(to, expectedTomorrow)).toBe(true)
    expect(to.getTime()).toBeGreaterThan(from.getTime())
  })

  it("parses weekday intent: `art friday` and `music next friday` differ by 7 days", () => {
    const friday = parseDateExpression("art friday")
    const nextFriday = parseDateExpression("music next friday")
    expect(friday.date_from).toBeTruthy()
    expect(nextFriday.date_from).toBeTruthy()

    const fridayFrom = new Date(friday.date_from!)
    const nextFrom = new Date(nextFriday.date_from!)

    expect(fridayFrom.getDay()).toBe(5) // Friday
    expect(nextFrom.getDay()).toBe(5) // Friday

    const plus7 = new Date(fridayFrom)
    plus7.setDate(plus7.getDate() + 7)
    expect(nextFrom.toISOString().slice(0, 10)).toBe(plus7.toISOString().slice(0, 10))
  })

  it("parseSearchIntent attaches time for Athens markets May 2026 query", () => {
    const intent = parseSearchIntent("Markets in Athens Greece 01 May to 03 May 2026")
    expect(intent.time?.date_from).toBeTruthy()
    expect(intent.time?.date_to).toBeTruthy()
    const from = new Date(intent.time!.date_from!)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(1)
  })

  it("parses explicit day-month range: Markets in Athens … 01 May to 03 May 2026", () => {
    const res = parseDateExpression("Markets in Athens Greece 01 May to 03 May 2026")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(1)
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(4)
    expect(to.getDate()).toBe(3)
    expect(to.getTime()).toBeGreaterThanOrEqual(from.getTime())
  })

  it("parses month-first variant: May 1 to May 3, 2026", () => {
    const res = parseDateExpression("events May 1 to May 3, 2026 downtown")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(1)
    expect(to.getMonth()).toBe(4)
    expect(to.getDate()).toBe(3)
  })

  it("parses cross-month range same year: 28 May to 3 June 2026", () => {
    const res = parseDateExpression("festival 28 May to 3 June 2026")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(28)
    expect(to.getMonth()).toBe(5)
    expect(to.getDate()).toBe(3)
  })
})

