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
})
