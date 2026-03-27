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

  it("parses `in June` as full calendar month when June is still ahead (March ref)", () => {
    const res = parseDateExpression("markets in paris in june")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getMonth()).toBe(5)
    expect(from.getDate()).toBe(1)
    expect(from.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(5)
    expect(to.getDate()).toBe(30)
  })

  it("parses `in May` as next calendar year when May has already passed (June ref)", () => {
    vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"))
    const res = parseDateExpression("family events in berlin in may")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getMonth()).toBe(4)
    expect(from.getFullYear()).toBe(2027)
    expect(to.getMonth()).toBe(4)
    expect(to.getDate()).toBe(31)
    vi.setSystemTime(new Date("2026-03-18T10:00:00.000Z"))
  })

  it("explicit `in May 2026` wins over rolling year rule", () => {
    const res = parseDateExpression("exhibitions in rome in may 2026")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(4)
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(4)
    expect(to.getDate()).toBe(31)
  })

  it("parses `May 2026` month + year without `in`", () => {
    const res = parseDateExpression("may 2026 art shows")
    expect(res.date_from).toBeTruthy()
    const from = new Date(res.date_from!)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(4)
  })

  it("parses leading `June markets` as full June window (rolling year from March ref)", () => {
    const res = parseDateExpression("june markets near me")
    expect(res.date_from).toBeTruthy()
    const from = new Date(res.date_from!)
    expect(from.getMonth()).toBe(5)
    expect(from.getFullYear()).toBe(2026)
  })

  it("parses trailing month token `… Berlin June` as full June window (May excluded at tail)", () => {
    const res = parseDateExpression("family events berlin june")
    expect(res.date_from).toBeTruthy()
    const from = new Date(res.date_from!)
    expect(from.getMonth()).toBe(5)
    expect(from.getFullYear()).toBe(2026)
  })

  it("explicit day range still beats month window", () => {
    const res = parseDateExpression("Markets in Athens Greece 01 May to 03 May 2026")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getDate()).toBe(1)
    expect(to.getDate()).toBe(3)
  })

  it("parses single calendar day: day-first with year (15 May 2026)", () => {
    const res = parseDateExpression("comedy gigs 15 may 2026 melbourne")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    expect(res.relativeWindowType).toBe("calendar_day")
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(15)
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(4)
    expect(to.getDate()).toBe(15)
    expect(to.getTime()).toBeGreaterThanOrEqual(from.getTime())
  })

  it("parses single calendar day: month-first with optional comma (May 15, 2026)", () => {
    const res = parseDateExpression("market may 15, 2026 sydney")
    expect(res.relativeWindowType).toBe("calendar_day")
    const from = new Date(res.date_from!)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(15)
  })

  it("yearless single day uses current year when the day is still ahead (March ref → 15 May)", () => {
    const res = parseDateExpression("gigs on 15 may brisbane")
    expect(res.relativeWindowType).toBe("calendar_day")
    const from = new Date(res.date_from!)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(15)
  })

  it("yearless single day rolls to next year when that date has passed (June ref → 15 May → 2027)", () => {
    vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"))
    const res = parseDateExpression("events 15 may berlin")
    expect(res.relativeWindowType).toBe("calendar_day")
    const from = new Date(res.date_from!)
    expect(from.getFullYear()).toBe(2027)
    expect(from.getMonth()).toBe(4)
    expect(from.getDate()).toBe(15)
    vi.setSystemTime(new Date("2026-03-18T10:00:00.000Z"))
  })

  it("does not treat `May 2026` as a single day (still full month window)", () => {
    const res = parseDateExpression("may 2026 art shows")
    expect(res.relativeWindowType).toBe("month")
    const from = new Date(res.date_from!)
    expect(from.getDate()).toBe(1)
  })

  it("rejects invalid single-day calendar dates", () => {
    const res = parseDateExpression("show 31 april 2026")
    expect(res.date_from).toBeFalsy()
    expect(res.date_to).toBeFalsy()
  })

  it("parses Easter as multi-day window around Western Easter 2026", () => {
    const res = parseDateExpression("events in echuca easter")
    expect(res.date_from).toBeTruthy()
    expect(res.date_to).toBeTruthy()
    const from = new Date(res.date_from!)
    const to = new Date(res.date_to!)
    expect(res.date_from!.startsWith("2026-")).toBe(true)
    expect(res.date_to!.startsWith("2026-")).toBe(true)
    expect(to.getTime()).toBeGreaterThan(from.getTime())
    const spanDays = (to.getTime() - from.getTime()) / (86400 * 1000)
    expect(spanDays).toBeGreaterThanOrEqual(3)
    expect(spanDays).toBeLessThanOrEqual(5)
  })

  it("Easter long weekend uses same window as Easter (not generic Sat–Sun)", () => {
    const easter = parseDateExpression("echuca easter")
    const longW = parseDateExpression("echuca easter long weekend")
    expect(easter.date_from).toBe(longW.date_from)
    expect(easter.date_to).toBe(longW.date_to)
  })

  it("parseSearchIntent: Echuca place is not polluted by time tails; time attaches", () => {
    expect(parseSearchIntent("Events in Echuca this weekend").place?.city).toBe("Echuca")
    expect(parseSearchIntent("Events in Echuca Easter").place?.city).toBe("Echuca")
    expect(parseSearchIntent("Events in Echuca Easter long weekend").place?.city).toBe("Echuca")
    expect(parseSearchIntent("Events in Echuca").place?.city).toBe("Echuca")
    expect(parseSearchIntent("Events in Echuca this weekend").time?.date_from).toBeTruthy()
    expect(parseSearchIntent("Events in Echuca Easter").time?.date_from).toBeTruthy()
    expect(parseSearchIntent("Events in Echuca Easter long weekend").time?.date_from).toBeTruthy()
  })
})

