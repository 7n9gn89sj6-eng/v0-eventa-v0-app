import { describe, it, expect, beforeEach, vi } from "vitest"
import { DateTime } from "luxon"
import { parseDatePhrase, parseTime, isPastDateTime } from "@/lib/date-parser"

const MELBOURNE_TZ = "Australia/Melbourne"

describe("date-parser", () => {
  describe("parseDatePhrase", () => {
    beforeEach(() => {
      // Mock current time to 2024-06-15 10:00 Melbourne time (winter, UTC+10)
      vi.useFakeTimers()
      vi.setSystemTime(DateTime.fromISO("2024-06-15T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())
    })

    it("should parse 'today' correctly", () => {
      expect(parseDatePhrase("today")).toBe("2024-06-15")
    })

    it("should parse 'tomorrow' correctly", () => {
      expect(parseDatePhrase("tomorrow")).toBe("2024-06-16")
    })

    it("should parse 'next Monday' correctly", () => {
      // June 15, 2024 is a Saturday, next Monday is June 17
      expect(parseDatePhrase("next Monday")).toBe("2024-06-17")
    })

    it("should parse 'this weekend' correctly", () => {
      // June 15, 2024 is a Saturday
      expect(parseDatePhrase("this weekend")).toBe("2024-06-15")
    })

    it("should parse 'next month' correctly", () => {
      expect(parseDatePhrase("next month")).toBe("2024-07-01")
    })

    it("should return ISO date as-is", () => {
      expect(parseDatePhrase("2024-12-25")).toBe("2024-12-25")
    })

    it("should return null for invalid phrases", () => {
      expect(parseDatePhrase("invalid date")).toBeNull()
    })
  })

  describe("parseDatePhrase - Sunday edge cases", () => {
    beforeEach(() => {
      // Mock current time to Sunday, June 16, 2024 10:00 Melbourne time (winter, UTC+10)
      vi.useFakeTimers()
      vi.setSystemTime(DateTime.fromISO("2024-06-16T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())
    })

    it("should parse 'this weekend' when today is Sunday", () => {
      // Sunday June 16, 2024 - should return today (Sunday)
      expect(parseDatePhrase("this weekend")).toBe("2024-06-16")
    })

    it("should parse 'next Monday' when today is Sunday", () => {
      // Sunday June 16, 2024 - next Monday is June 17
      expect(parseDatePhrase("next Monday")).toBe("2024-06-17")
    })

    it("should parse 'next Tuesday' when today is Sunday", () => {
      // Sunday June 16, 2024 - next Tuesday is June 18
      expect(parseDatePhrase("next Tuesday")).toBe("2024-06-18")
    })

    it("should parse 'next Sunday' when today is Sunday", () => {
      // Sunday June 16, 2024 - next Sunday is June 23 (7 days later)
      expect(parseDatePhrase("next Sunday")).toBe("2024-06-23")
    })

    it("should parse 'tomorrow' when today is Sunday", () => {
      // Sunday June 16, 2024 - tomorrow is Monday June 17
      expect(parseDatePhrase("tomorrow")).toBe("2024-06-17")
    })
  })

  describe("parseDatePhrase - Sunday edge cases during DST", () => {
    it("should handle 'this weekend' on Sunday during DST start (October)", () => {
      // Sunday October 6, 2024 - DST starts (UTC+10 → UTC+11)
      vi.setSystemTime(DateTime.fromISO("2024-10-06T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(parseDatePhrase("this weekend")).toBe("2024-10-06")
      expect(parseDatePhrase("next Monday")).toBe("2024-10-07")
    })

    it("should handle 'next Monday' on Sunday during DST end (April)", () => {
      // Sunday April 7, 2024 - DST ends (UTC+11 → UTC+10)
      vi.setSystemTime(DateTime.fromISO("2024-04-07T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(parseDatePhrase("this weekend")).toBe("2024-04-07")
      expect(parseDatePhrase("next Monday")).toBe("2024-04-08")
    })

    it("should handle 'next Sunday' on Sunday before DST transition", () => {
      // Sunday September 29, 2024 (week before DST starts on Oct 6)
      vi.setSystemTime(DateTime.fromISO("2024-09-29T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // Next Sunday is October 6 (when DST starts)
      expect(parseDatePhrase("next Sunday")).toBe("2024-10-06")
    })

    it("should handle 'next Monday' on Sunday before DST end", () => {
      // Sunday March 31, 2024 (week before DST ends on Apr 7)
      vi.setSystemTime(DateTime.fromISO("2024-03-31T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // Next Monday is April 1
      expect(parseDatePhrase("next Monday")).toBe("2024-04-01")
    })
  })

  describe("parseDatePhrase - DST boundaries", () => {
    it("should handle date parsing during DST transition (October)", () => {
      // October 6, 2024 - DST starts (UTC+10 → UTC+11)
      vi.setSystemTime(DateTime.fromISO("2024-10-06T02:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(parseDatePhrase("today")).toBe("2024-10-06")
      expect(parseDatePhrase("tomorrow")).toBe("2024-10-07")
    })

    it("should handle date parsing during DST end (April)", () => {
      // April 7, 2024 - DST ends (UTC+11 → UTC+10)
      vi.setSystemTime(DateTime.fromISO("2024-04-07T02:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(parseDatePhrase("today")).toBe("2024-04-07")
      expect(parseDatePhrase("tomorrow")).toBe("2024-04-08")
    })

    it("should handle 'next Monday' across DST boundary", () => {
      // October 4, 2024 (Friday before DST starts on Oct 6)
      vi.setSystemTime(DateTime.fromISO("2024-10-04T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // Next Monday is October 7 (after DST transition)
      expect(parseDatePhrase("next Monday")).toBe("2024-10-07")
    })
  })

  describe("parseTime", () => {
    it("should parse 12-hour format with pm", () => {
      expect(parseTime("8pm")).toBe("20:00")
      expect(parseTime("8:30pm")).toBe("20:30")
      expect(parseTime("8:30 pm")).toBe("20:30")
    })

    it("should parse 12-hour format with am", () => {
      expect(parseTime("8am")).toBe("08:00")
      expect(parseTime("8:30am")).toBe("08:30")
    })

    it("should parse 24-hour format", () => {
      expect(parseTime("20:00")).toBe("20:00")
      expect(parseTime("08:30")).toBe("08:30")
    })

    it("should handle noon and midnight", () => {
      expect(parseTime("12pm")).toBe("12:00")
      expect(parseTime("12am")).toBe("00:00")
    })

    it("should return null for invalid times", () => {
      expect(parseTime("25:00")).toBeNull()
      expect(parseTime("8:70pm")).toBeNull()
      expect(parseTime("invalid")).toBeNull()
    })

    // Defensive validation tests
    it("should reject hours outside 1-12 for 12-hour format", () => {
      expect(parseTime("0am")).toBeNull()
      expect(parseTime("13pm")).toBeNull()
      expect(parseTime("15am")).toBeNull()
      expect(parseTime("0:30pm")).toBeNull()
    })

    it("should reject hours outside 0-23 for 24-hour format", () => {
      expect(parseTime("24:00")).toBeNull()
      expect(parseTime("25:30")).toBeNull()
      expect(parseTime("30:00")).toBeNull()
    })

    it("should reject minutes outside 0-59", () => {
      expect(parseTime("8:60pm")).toBeNull()
      expect(parseTime("8:99am")).toBeNull()
      expect(parseTime("20:60")).toBeNull()
      expect(parseTime("10:75")).toBeNull()
    })

    it("should reject negative inputs", () => {
      expect(parseTime("-5pm")).toBeNull()
      expect(parseTime("8:-30pm")).toBeNull()
      expect(parseTime("-8:30")).toBeNull()
    })

    it("should reject non-numeric inputs", () => {
      expect(parseTime("abc:30pm")).toBeNull()
      expect(parseTime("8:xypm")).toBeNull()
      expect(parseTime("nottime")).toBeNull()
    })

    it("should accept valid edge cases", () => {
      expect(parseTime("1am")).toBe("01:00")
      expect(parseTime("12pm")).toBe("12:00")
      expect(parseTime("12am")).toBe("00:00")
      expect(parseTime("0:00")).toBe("00:00")
      expect(parseTime("23:59")).toBe("23:59")
    })
  })

  describe("isPastDateTime - DST handling", () => {
    it("should correctly identify past times during standard time (winter)", () => {
      // June 15, 2024 10:00 (UTC+10)
      vi.setSystemTime(DateTime.fromISO("2024-06-15T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(isPastDateTime("2024-06-15", "09:00")).toBe(true)
      expect(isPastDateTime("2024-06-15", "11:00")).toBe(false)
    })

    it("should correctly identify past times during DST (summer)", () => {
      // December 15, 2024 10:00 (UTC+11)
      vi.setSystemTime(DateTime.fromISO("2024-12-15T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(isPastDateTime("2024-12-15", "09:00")).toBe(true)
      expect(isPastDateTime("2024-12-15", "11:00")).toBe(false)
    })

    it("should handle times during DST transition", () => {
      // October 6, 2024 01:30 (just before DST starts at 02:00)
      vi.setSystemTime(DateTime.fromISO("2024-10-06T01:30:00", { zone: MELBOURNE_TZ }).toJSDate())

      // Time at 01:00 should be in the past
      expect(isPastDateTime("2024-10-06", "01:00")).toBe(true)
      // Time at 03:00 should be in the future (after DST jump)
      expect(isPastDateTime("2024-10-06", "03:00")).toBe(false)
    })

    it("should handle times during DST end", () => {
      // April 7, 2024 02:30 (just after DST ends at 02:00)
      vi.setSystemTime(DateTime.fromISO("2024-04-07T02:30:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(isPastDateTime("2024-04-07", "02:00")).toBe(true)
      expect(isPastDateTime("2024-04-07", "03:00")).toBe(false)
    })
  })

  describe("REGRESSION LOCK: Sunday 'this weekend' behavior", () => {
    it("should return NEXT Saturday when 'this weekend' is called on Sunday (standard time)", () => {
      // Sunday June 16, 2024 10:00 (winter, UTC+10)
      vi.setSystemTime(DateTime.fromISO("2024-06-16T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday, "this weekend" should point to next Saturday (June 22)
      const result = parseDatePhrase("this weekend")
      expect(result).toBe("2024-06-22")
    })

    it("should return NEXT Saturday when 'this weekend' is called on Sunday (DST active)", () => {
      // Sunday December 15, 2024 10:00 (summer, UTC+11)
      vi.setSystemTime(DateTime.fromISO("2024-12-15T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday, "this weekend" should point to next Saturday (December 21)
      const result = parseDatePhrase("this weekend")
      expect(result).toBe("2024-12-21")
    })

    it("should return tomorrow (Monday) when 'next Monday' is called on Sunday", () => {
      // Sunday June 16, 2024 10:00
      vi.setSystemTime(DateTime.fromISO("2024-06-16T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday, "next Monday" should be tomorrow (June 17)
      const result = parseDatePhrase("next Monday")
      expect(result).toBe("2024-06-17")
    })

    it("should handle 'next Tuesday' correctly from Sunday", () => {
      // Sunday June 16, 2024 10:00
      vi.setSystemTime(DateTime.fromISO("2024-06-16T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday, "next Tuesday" should be in 2 days (June 18)
      const result = parseDatePhrase("next Tuesday")
      expect(result).toBe("2024-06-18")
    })
  })

  describe("REGRESSION LOCK: Sunday behavior during DST transitions", () => {
    it("should handle 'this weekend' on Sunday during DST START (October)", () => {
      // Sunday October 6, 2024 10:00 - DST starts (clocks forward 02:00 → 03:00)
      vi.setSystemTime(DateTime.fromISO("2024-10-06T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday Oct 6, "this weekend" should point to next Saturday (Oct 12)
      const result = parseDatePhrase("this weekend")
      expect(result).toBe("2024-10-12")
    })

    it("should handle 'next Monday' on Sunday during DST START", () => {
      // Sunday October 6, 2024 10:00 - DST starts
      vi.setSystemTime(DateTime.fromISO("2024-10-06T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday Oct 6, "next Monday" should be tomorrow (Oct 7)
      const result = parseDatePhrase("next Monday")
      expect(result).toBe("2024-10-07")
    })

    it("should handle 'this weekend' on Sunday during DST END (April)", () => {
      // Sunday April 6, 2025 10:00 - DST ends (clocks back 03:00 → 02:00)
      vi.setSystemTime(DateTime.fromISO("2025-04-06T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday Apr 6, "this weekend" should point to next Saturday (Apr 12)
      const result = parseDatePhrase("this weekend")
      expect(result).toBe("2025-04-12")
    })

    it("should handle 'next Monday' on Sunday during DST END", () => {
      // Sunday April 6, 2025 10:00 - DST ends
      vi.setSystemTime(DateTime.fromISO("2025-04-06T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday Apr 6, "next Monday" should be tomorrow (Apr 7)
      const result = parseDatePhrase("next Monday")
      expect(result).toBe("2025-04-07")
    })

    it("should handle 'next Sunday' on Sunday across DST boundary", () => {
      // Sunday September 29, 2024 10:00 (week before DST starts)
      vi.setSystemTime(DateTime.fromISO("2024-09-29T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // From Sunday Sep 29, "next Sunday" should be Oct 6 (when DST starts)
      const result = parseDatePhrase("next Sunday")
      expect(result).toBe("2024-10-06")
    })

    it("should handle weekday calculations across DST start boundary", () => {
      // Friday October 4, 2024 10:00 (2 days before DST starts)
      vi.setSystemTime(DateTime.fromISO("2024-10-04T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // "next Monday" should be Oct 7 (after DST transition)
      expect(parseDatePhrase("next Monday")).toBe("2024-10-07")
      // "this weekend" should be tomorrow (Saturday Oct 5)
      expect(parseDatePhrase("this weekend")).toBe("2024-10-05")
    })

    it("should handle weekday calculations across DST end boundary", () => {
      // Friday April 4, 2025 10:00 (2 days before DST ends)
      vi.setSystemTime(DateTime.fromISO("2025-04-04T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // "next Monday" should be Apr 7 (after DST transition)
      expect(parseDatePhrase("next Monday")).toBe("2025-04-07")
      // "this weekend" should be tomorrow (Saturday Apr 5)
      expect(parseDatePhrase("this weekend")).toBe("2025-04-05")
    })
  })

  describe("REGRESSION LOCK: Weekday calculation stability", () => {
    it("should correctly calculate days for all weekdays from Sunday", () => {
      // Sunday June 16, 2024 10:00
      vi.setSystemTime(DateTime.fromISO("2024-06-16T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      // Verify all weekdays calculate correctly from Sunday
      expect(parseDatePhrase("next Monday")).toBe("2024-06-17") // +1 day
      expect(parseDatePhrase("next Tuesday")).toBe("2024-06-18") // +2 days
      expect(parseDatePhrase("next Wednesday")).toBe("2024-06-19") // +3 days
      expect(parseDatePhrase("next Thursday")).toBe("2024-06-20") // +4 days
      expect(parseDatePhrase("next Friday")).toBe("2024-06-21") // +5 days
      expect(parseDatePhrase("next Saturday")).toBe("2024-06-22") // +6 days
      expect(parseDatePhrase("next Sunday")).toBe("2024-06-23") // +7 days
    })

    it("should correctly calculate days for all weekdays from Monday", () => {
      // Monday June 17, 2024 10:00
      vi.setSystemTime(DateTime.fromISO("2024-06-17T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(parseDatePhrase("next Tuesday")).toBe("2024-06-18") // +1 day
      expect(parseDatePhrase("next Wednesday")).toBe("2024-06-19") // +2 days
      expect(parseDatePhrase("next Thursday")).toBe("2024-06-20") // +3 days
      expect(parseDatePhrase("next Friday")).toBe("2024-06-21") // +4 days
      expect(parseDatePhrase("next Saturday")).toBe("2024-06-22") // +5 days
      expect(parseDatePhrase("next Sunday")).toBe("2024-06-23") // +6 days
      expect(parseDatePhrase("next Monday")).toBe("2024-06-24") // +7 days
    })

    it("should correctly calculate days for all weekdays from Saturday", () => {
      // Saturday June 15, 2024 10:00
      vi.setSystemTime(DateTime.fromISO("2024-06-15T10:00:00", { zone: MELBOURNE_TZ }).toJSDate())

      expect(parseDatePhrase("next Sunday")).toBe("2024-06-16") // +1 day
      expect(parseDatePhrase("next Monday")).toBe("2024-06-17") // +2 days
      expect(parseDatePhrase("next Tuesday")).toBe("2024-06-18") // +3 days
      expect(parseDatePhrase("next Wednesday")).toBe("2024-06-19") // +4 days
      expect(parseDatePhrase("next Thursday")).toBe("2024-06-20") // +5 days
      expect(parseDatePhrase("next Friday")).toBe("2024-06-21") // +6 days
      expect(parseDatePhrase("next Saturday")).toBe("2024-06-22") // +7 days
    })
  })
})
