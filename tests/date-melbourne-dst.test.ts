import { describe, it, expect } from "vitest"
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz"

const TZ = "Australia/Melbourne"

describe("Melbourne DST boundary tests (date-fns-tz)", () => {
  describe("DST forward shift (October)", () => {
    it("should handle pre-DST to post-DST forward shift (Oct)", () => {
      // October 5, 2025 at 01:30 - before the jump to 03:00 at 02:00
      // When DST starts, clocks jump from 02:00 to 03:00
      const localDateStr = "2025-10-05T01:30:00"
      const localDate = new Date(localDateStr)

      // Convert local Melbourne time to UTC
      const utc = zonedTimeToUtc(localDate, TZ)

      // Convert back to Melbourne time
      const back = utcToZonedTime(utc, TZ)

      expect(back.getFullYear()).toBe(2025)
      expect(back.getMonth()).toBe(9) // October is 9 (0-indexed)
      expect(back.getDate()).toBe(5)
    })

    it("should handle time during DST gap (02:00-03:00)", () => {
      // October 5, 2025 at 02:30 - this time doesn't exist!
      // Clocks jump from 02:00 to 03:00
      const localDateStr = "2025-10-05T02:30:00"
      const localDate = new Date(localDateStr)

      const utc = zonedTimeToUtc(localDate, TZ)
      const back = utcToZonedTime(utc, TZ)

      // The time should be adjusted forward
      expect(back.getFullYear()).toBe(2025)
      expect(back.getMonth()).toBe(9)
      expect(back.getDate()).toBe(5)
      // Time should be >= 03:00 since 02:30 doesn't exist
      expect(back.getHours()).toBeGreaterThanOrEqual(3)
    })

    it("should handle post-DST time correctly", () => {
      // October 5, 2025 at 03:30 - after DST starts
      const localDateStr = "2025-10-05T03:30:00"
      const localDate = new Date(localDateStr)

      const utc = zonedTimeToUtc(localDate, TZ)
      const back = utcToZonedTime(utc, TZ)

      expect(back.getFullYear()).toBe(2025)
      expect(back.getMonth()).toBe(9)
      expect(back.getDate()).toBe(5)
      expect(back.getHours()).toBe(3)
      expect(back.getMinutes()).toBe(30)
    })
  })

  describe("DST backward shift (April)", () => {
    it("should handle post-DST to standard time backward shift (Apr)", () => {
      // April 6, 2025 at 01:30 - during the repeated hour
      // When DST ends, clocks go back from 03:00 to 02:00
      // So 02:00-03:00 happens twice
      const localDateStr = "2025-04-06T01:30:00"
      const localDate = new Date(localDateStr)

      const utc = zonedTimeToUtc(localDate, TZ)
      const back = utcToZonedTime(utc, TZ)

      expect(back.getFullYear()).toBe(2025)
      expect(back.getMonth()).toBe(3) // April is 3 (0-indexed)
      expect(back.getDate()).toBe(6)
    })

    it("should handle first occurrence of repeated hour", () => {
      // April 6, 2025 at 02:30 (first occurrence, DST still active)
      const localDateStr = "2025-04-06T02:30:00"
      const localDate = new Date(localDateStr)

      const utc = zonedTimeToUtc(localDate, TZ)
      const back = utcToZonedTime(utc, TZ)

      expect(back.getFullYear()).toBe(2025)
      expect(back.getMonth()).toBe(3)
      expect(back.getDate()).toBe(6)
      // Should be in the 02:00-03:00 range
      expect(back.getHours()).toBe(2)
      expect(back.getMinutes()).toBe(30)
    })

    it("should handle time after DST ends", () => {
      // April 6, 2025 at 03:30 - after DST ends
      const localDateStr = "2025-04-06T03:30:00"
      const localDate = new Date(localDateStr)

      const utc = zonedTimeToUtc(localDate, TZ)
      const back = utcToZonedTime(utc, TZ)

      expect(back.getFullYear()).toBe(2025)
      expect(back.getMonth()).toBe(3)
      expect(back.getDate()).toBe(6)
      expect(back.getHours()).toBe(3)
      expect(back.getMinutes()).toBe(30)
    })
  })

  describe("Round-trip conversions across DST", () => {
    it("should maintain date integrity across DST start", () => {
      // Test dates before, during, and after DST transition
      const testDates = [
        "2025-10-04T23:00:00", // Before DST
        "2025-10-05T01:00:00", // Just before transition
        "2025-10-05T03:30:00", // After transition
      ]

      testDates.forEach((dateStr) => {
        const localDate = new Date(dateStr)
        const utc = zonedTimeToUtc(localDate, TZ)
        const back = utcToZonedTime(utc, TZ)

        // Year, month, and date should be preserved
        expect(back.getFullYear()).toBe(localDate.getFullYear())
        expect(back.getMonth()).toBe(localDate.getMonth())
      })
    })

    it("should maintain date integrity across DST end", () => {
      const testDates = [
        "2025-04-05T23:00:00", // Before DST ends
        "2025-04-06T01:00:00", // Before repeated hour
        "2025-04-06T03:30:00", // After DST ends
      ]

      testDates.forEach((dateStr) => {
        const localDate = new Date(dateStr)
        const utc = zonedTimeToUtc(localDate, TZ)
        const back = utcToZonedTime(utc, TZ)

        expect(back.getFullYear()).toBe(localDate.getFullYear())
        expect(back.getMonth()).toBe(localDate.getMonth())
      })
    })
  })
})
