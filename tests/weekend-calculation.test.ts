import { describe, it, expect } from "vitest"
import { DateTime } from "luxon"

/**
 * Tests for weekend calculation logic
 * Verifies that "this weekend" correctly calculates days until Saturday
 * across all days of the week, especially Sunday (weekday=7)
 */

describe("Weekend Calculation", () => {
  it("should calculate correct days until Saturday from Sunday", () => {
    // Sunday in Luxon has weekday = 7
    const sunday = DateTime.fromObject({ weekday: 7 })
    const daysUntilSaturday = (6 - sunday.weekday + 7) % 7

    // From Sunday to Saturday should be 6 days
    expect(daysUntilSaturday).toBe(6)
  })

  it("should calculate correct days until Saturday from Monday", () => {
    const monday = DateTime.fromObject({ weekday: 1 })
    const daysUntilSaturday = (6 - monday.weekday + 7) % 7

    // From Monday to Saturday should be 5 days
    expect(daysUntilSaturday).toBe(5)
  })

  it("should calculate correct days until Saturday from Tuesday", () => {
    const tuesday = DateTime.fromObject({ weekday: 2 })
    const daysUntilSaturday = (6 - tuesday.weekday + 7) % 7

    // From Tuesday to Saturday should be 4 days
    expect(daysUntilSaturday).toBe(4)
  })

  it("should calculate correct days until Saturday from Wednesday", () => {
    const wednesday = DateTime.fromObject({ weekday: 3 })
    const daysUntilSaturday = (6 - wednesday.weekday + 7) % 7

    // From Wednesday to Saturday should be 3 days
    expect(daysUntilSaturday).toBe(3)
  })

  it("should calculate correct days until Saturday from Thursday", () => {
    const thursday = DateTime.fromObject({ weekday: 4 })
    const daysUntilSaturday = (6 - thursday.weekday + 7) % 7

    // From Thursday to Saturday should be 2 days
    expect(daysUntilSaturday).toBe(2)
  })

  it("should calculate correct days until Saturday from Friday", () => {
    const friday = DateTime.fromObject({ weekday: 5 })
    const daysUntilSaturday = (6 - friday.weekday + 7) % 7

    // From Friday to Saturday should be 1 day
    expect(daysUntilSaturday).toBe(1)
  })

  it("should calculate correct days until Saturday from Saturday", () => {
    const saturday = DateTime.fromObject({ weekday: 6 })
    const daysUntilSaturday = (6 - saturday.weekday + 7) % 7

    // From Saturday to Saturday should be 0 days (today)
    expect(daysUntilSaturday).toBe(0)
  })

  it("should never return negative days", () => {
    // Test all days of the week
    for (let weekday = 1; weekday <= 7; weekday++) {
      const daysUntilSaturday = (6 - weekday + 7) % 7
      expect(daysUntilSaturday).toBeGreaterThanOrEqual(0)
      expect(daysUntilSaturday).toBeLessThan(7)
    }
  })

  it("should correctly calculate weekend date range from Sunday", () => {
    // Create a specific Sunday: 2025-01-05 (a Sunday)
    const sunday = DateTime.fromISO("2025-01-05", { zone: "Australia/Melbourne" })
    expect(sunday.weekday).toBe(7) // Verify it's Sunday

    const daysUntilSaturday = (6 - sunday.weekday + 7) % 7
    const saturday = sunday.plus({ days: daysUntilSaturday })

    // Saturday should be 2025-01-11
    expect(saturday.toISODate()).toBe("2025-01-11")
    expect(saturday.weekday).toBe(6) // Verify it's Saturday

    // Sunday of the weekend should be 2025-01-12
    const sundayOfWeekend = saturday.plus({ days: 1 })
    expect(sundayOfWeekend.toISODate()).toBe("2025-01-12")
    expect(sundayOfWeekend.weekday).toBe(7) // Verify it's Sunday
  })

  it("should correctly calculate weekend date range from Saturday", () => {
    // Create a specific Saturday: 2025-01-11
    const saturday = DateTime.fromISO("2025-01-11", { zone: "Australia/Melbourne" })
    expect(saturday.weekday).toBe(6) // Verify it's Saturday

    const daysUntilSaturday = (6 - saturday.weekday + 7) % 7
    const targetSaturday = saturday.plus({ days: daysUntilSaturday })

    // Should be the same Saturday (0 days)
    expect(targetSaturday.toISODate()).toBe("2025-01-11")
    expect(daysUntilSaturday).toBe(0)
  })
})
