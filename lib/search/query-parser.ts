/**
 * Query parser utilities for converting Intent API responses to URL parameters
 */

import { addDays, startOfWeek, endOfWeek, addWeeks } from "date-fns"

/**
 * Convert Intent API response to URL search parameters
 */
export function intentToURLParams(intentResponse: any): URLSearchParams {
  const params = new URLSearchParams()
  const extracted = intentResponse.extracted || {}

  // Add original query if present (use the original query from the request, not from extracted)
  // The query should be passed separately or we can use the paraphrase
  if (intentResponse.query) {
    params.set("q", intentResponse.query)
  } else if (intentResponse.description) {
    params.set("q", intentResponse.description)
  }

  // Add city if extracted (check for empty strings too)
  if (extracted.city && extracted.city.trim().length > 0) {
    params.set("city", extracted.city.trim())
  }

  // Add country if extracted (helps with location disambiguation)
  if (extracted.country && extracted.country.trim().length > 0) {
    params.set("country", extracted.country.trim())
  }

  // Add category if extracted (check both type and category fields)
  if (extracted.type) {
    const category = categoryToEnum(extracted.type)
    if (category) {
      params.set("category", category)
    }
  } else if (extracted.category) {
    const category = categoryToEnum(extracted.category)
    if (category) {
      params.set("category", category)
    }
  }

  // Add date range if extracted (use date_iso if available, otherwise parse date)
  // Trip intent duration: if isTripIntent is true and duration is provided, use it to extend date range
  const isTripIntent = intentResponse.isTripIntent === true
  const tripDuration = intentResponse.duration
  
  if (extracted.date_iso) {
    const date = new Date(extracted.date_iso)
    
    // Check if this is a month-only date (no specific day mentioned)
    // Pattern: "March 2026", "March 2025" (month name + year, no day)
    const dateStr = (extracted.date || "").toLowerCase().trim()
    const monthYearPattern = /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i
    const isMonthOnly = monthYearPattern.test(dateStr)
    
    if (isMonthOnly) {
      // Month range: from first day to last day of the month
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      startOfMonth.setHours(0, 0, 0, 0)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      endOfMonth.setHours(23, 59, 59, 999)
      params.set("date_from", startOfMonth.toISOString())
      params.set("date_to", endOfMonth.toISOString())
    } else {
      // Single day: only extend by duration if explicitly provided
      // Conservative: don't extend single-day dates unless user mentioned duration
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endDay = new Date(date)
      // Only extend if duration was explicitly mentioned, not inferred
      if (isTripIntent && tripDuration && tripDuration > 0) {
        // User explicitly mentioned duration ("for a week", "for 5 days")
        endDay.setDate(endDay.getDate() + tripDuration - 1) // -1 because start day counts as day 1
      }
      // If no duration, endDay remains the same day (single-day range)
      endDay.setHours(23, 59, 59, 999)
      params.set("date_from", startOfDay.toISOString())
      params.set("date_to", endDay.toISOString())
    }
  } else if (extracted.date) {
    const dateRange = parseDateExpression(extracted.date)
    if (dateRange.date_from) {
      params.set("date_from", dateRange.date_from)
      // Only extend by duration if explicitly provided (not inferred)
      // This preserves the natural date range from parseDateExpression
      if (!dateRange.date_to && isTripIntent && tripDuration && tripDuration > 0) {
        // User explicitly mentioned duration - safe to extend
        const startDate = new Date(dateRange.date_from)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + tripDuration - 1)
        endDate.setHours(23, 59, 59, 999)
        params.set("date_to", endDate.toISOString())
      } else if (dateRange.date_to) {
        // Use the parsed date_to (don't extend further)
        params.set("date_to", dateRange.date_to)
      }
    }
    if (dateRange.date_to) {
      params.set("date_to", dateRange.date_to)
    }
  }
  // REMOVED: Don't create date filter from trip intent + duration alone
  // Only create date filters when explicit date or time context is present
  // This prevents "I'm going to Berlin" (said in Dec for March trip) from excluding March events

  return params
}

/**
 * Map user-friendly category names to EventCategory enum-friendly values
 */
export function categoryToEnum(categoryString: string): string | null {
  if (!categoryString) return null

  const normalized = categoryString.toLowerCase().trim()

  // Music & Nightlife
  if (["music", "concert", "jazz", "rock", "classical", "dj", "nightlife", "club", "party"].includes(normalized)) {
    return "music"
  }

  // Arts & Culture
  if (
    ["art", "arts", "culture", "exhibition", "gallery", "museum", "theater", "theatre", "performance"].includes(
      normalized,
    )
  ) {
    return "arts"
  }

  // Sports & Outdoors
  if (
    ["sports", "sport", "football", "soccer", "basketball", "running", "fitness", "outdoor", "hiking"].includes(
      normalized,
    )
  ) {
    return "sports"
  }

  // Food & Drink
  if (
    ["food", "drink", "restaurant", "cafe", "coffee", "dining", "culinary", "wine", "beer", "tasting"].includes(
      normalized,
    )
  ) {
    return "food"
  }

  // Family & Kids
  if (["family", "kids", "children", "playground", "education", "workshop"].includes(normalized)) {
    return "family"
  }

  // Community & Causes
  if (["community", "volunteer", "charity", "fundraiser", "social", "meetup", "networking"].includes(normalized)) {
    return "community"
  }

  // Learning & Talks
  if (["learning", "talk", "lecture", "seminar", "conference", "workshop", "class", "course"].includes(normalized)) {
    return "learning"
  }

  // Markets & Fairs
  if (["market", "markets", "fair", "fairs", "bazaar", "flea market", "farmers market"].includes(normalized)) {
    return "markets"
  }

  return null
}

const MONTH_NAME_ALT =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"

const MONTH_TOKEN_TO_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
}

function monthIndexFromToken(token: string): number | null {
  const key = token.toLowerCase().replace(/\.$/, "")
  const idx = MONTH_TOKEN_TO_INDEX[key]
  return idx === undefined ? null : idx
}

/**
 * Explicit ranges: "01 May to 03 May 2026", "May 1 to May 3, 2026", cross-month same year.
 */
function tryParseExplicitCalendarRange(normalized: string): {
  date_from?: string
  date_to?: string
} {
  const dayFirst = new RegExp(
    `(\\d{1,2})\\s+(${MONTH_NAME_ALT})\\s+to\\s+(\\d{1,2})\\s+(${MONTH_NAME_ALT})\\s+(\\d{4})\\b`,
    "i",
  )
  const dm = normalized.match(dayFirst)
  if (dm) {
    const year = Number.parseInt(dm[5], 10)
    const d1 = Number.parseInt(dm[1], 10)
    const d2 = Number.parseInt(dm[3], 10)
    const m1 = monthIndexFromToken(dm[2])
    const m2 = monthIndexFromToken(dm[4])
    const built = buildCalendarRangeIso(year, m1, d1, m2, d2)
    if (built) return built
  }

  const monthFirst = new RegExp(
    `(${MONTH_NAME_ALT})\\s+(\\d{1,2})\\s+to\\s+(${MONTH_NAME_ALT})\\s+(\\d{1,2})(?:,)?\\s+(\\d{4})\\b`,
    "i",
  )
  const mm = normalized.match(monthFirst)
  if (mm) {
    const year = Number.parseInt(mm[5], 10)
    const m1 = monthIndexFromToken(mm[1])
    const m2 = monthIndexFromToken(mm[3])
    const d1 = Number.parseInt(mm[2], 10)
    const d2 = Number.parseInt(mm[4], 10)
    const built = buildCalendarRangeIso(year, m1, d1, m2, d2)
    if (built) return built
  }

  return {}
}

function buildCalendarRangeIso(
  year: number,
  monthIndex1: number | null,
  day1: number,
  monthIndex2: number | null,
  day2: number,
): { date_from: string; date_to: string } | null {
  if (
    monthIndex1 === null ||
    monthIndex2 === null ||
    !Number.isFinite(year) ||
    year < 1900 ||
    year > 2100 ||
    day1 < 1 ||
    day1 > 31 ||
    day2 < 1 ||
    day2 > 31
  ) {
    return null
  }

  const dayStart = new Date(year, monthIndex1, day1)
  const dayEnd = new Date(year, monthIndex2, day2)
  if (dayStart.getFullYear() !== year || dayStart.getMonth() !== monthIndex1 || dayStart.getDate() !== day1) {
    return null
  }
  if (dayEnd.getFullYear() !== year || dayEnd.getMonth() !== monthIndex2 || dayEnd.getDate() !== day2) {
    return null
  }

  dayStart.setHours(0, 0, 0, 0)
  dayEnd.setHours(23, 59, 59, 999)

  if (dayEnd.getTime() < dayStart.getTime()) {
    const lo = new Date(year, monthIndex2, day2)
    lo.setHours(0, 0, 0, 0)
    const hi = new Date(year, monthIndex1, day1)
    hi.setHours(23, 59, 59, 999)
    return { date_from: lo.toISOString(), date_to: hi.toISOString() }
  }

  return {
    date_from: dayStart.toISOString(),
    date_to: dayEnd.toISOString(),
  }
}

/**
 * Full calendar month: "in May", "May 2026", "June markets …" (leading month + event noun).
 * Runs after explicit day ranges. Year: explicit 4-digit wins; else current year if the month
 * is strictly after the current calendar month, or the same month as today; otherwise next year.
 */
function tryParseMonthWindow(normalized: string, today: Date): {
  date_from?: string
  date_to?: string
} {
  const monthCap = `(${MONTH_NAME_ALT})`
  const y4 = `(\\d{4})`

  type Hit = { monthToken: string; explicitYear: number | null }
  let hit: Hit | null = null

  const inMonth = normalized.match(new RegExp(`\\bin\\s+${monthCap}(?:\\s+${y4})?\\b`, "i"))
  if (inMonth) {
    hit = {
      monthToken: inMonth[1],
      explicitYear: inMonth[2] ? Number.parseInt(inMonth[2], 10) : null,
    }
  }

  if (!hit) {
    const monthYear = normalized.match(new RegExp(`\\b${monthCap}\\s+${y4}\\b`, "i"))
    if (monthYear) {
      hit = {
        monthToken: monthYear[1],
        explicitYear: Number.parseInt(monthYear[2], 10),
      }
    }
  }

  if (!hit) {
    // Trailing month, but not bare `may` (modal / ambiguity with "next may", etc.).
    const trailingAlt =
      "january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
    const trailingMonth = normalized.match(new RegExp(`\\b(${trailingAlt})\\s*$`, "i"))
    if (trailingMonth) {
      hit = { monthToken: trailingMonth[1], explicitYear: null }
    }
  }

  if (!hit) {
    const afterEventNoun = new RegExp(
      `^${monthCap}\\s+(?:events?|markets?|exhibitions?|festival|festivals?|fair|fairs|show|shows|gigs?|concerts?|things\\s+to\\s+do)\\b`,
      "i",
    )
    const lead = normalized.match(afterEventNoun)
    if (lead) {
      hit = { monthToken: lead[1], explicitYear: null }
    }
  }

  if (!hit) return {}

  const monthIndex = monthIndexFromToken(hit.monthToken)
  if (monthIndex === null) return {}

  let year: number
  if (
    hit.explicitYear !== null &&
    Number.isFinite(hit.explicitYear) &&
    hit.explicitYear >= 1900 &&
    hit.explicitYear <= 2100
  ) {
    year = hit.explicitYear
  } else {
    const cy = today.getFullYear()
    const cm = today.getMonth()
    if (monthIndex > cm) year = cy
    else if (monthIndex < cm) year = cy + 1
    else year = cy
  }

  const start = new Date(year, monthIndex, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(year, monthIndex + 1, 0)
  end.setHours(23, 59, 59, 999)

  return {
    date_from: start.toISOString(),
    date_to: end.toISOString(),
  }
}

/**
 * Parse natural language date expressions into ISO date strings
 */
export function parseDateExpression(dateExpr: string): {
  date_from?: string
  date_to?: string
} {
  if (!dateExpr) return {}

  const normalized = dateExpr.toLowerCase().trim()
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Start of day

  // Tonight
  if (normalized.includes("tonight")) {
    const tonight = new Date()
    tonight.setHours(18, 0, 0, 0)
    const endOfNight = new Date()
    endOfNight.setHours(23, 59, 59, 999)
    return {
      date_from: tonight.toISOString(),
      date_to: endOfNight.toISOString(),
    }
  }

  // Today
  if (normalized.includes("today")) {
    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)
    return {
      date_from: today.toISOString(),
      date_to: endOfDay.toISOString(),
    }
  }

  // Tomorrow
  if (normalized.includes("tomorrow")) {
    const tomorrow = addDays(today, 1)
    const endOfTomorrow = new Date(tomorrow)
    endOfTomorrow.setHours(23, 59, 59, 999)
    return {
      date_from: tomorrow.toISOString(),
      date_to: endOfTomorrow.toISOString(),
    }
  }

  // Weekday names (e.g., "Friday", "this Friday", "next Friday")
  const weekdayToDow: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }

  const weekdayMatch = normalized.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)
  if (weekdayMatch) {
    const weekdayName = weekdayMatch[1].toLowerCase()
    const targetDow = weekdayToDow[weekdayName]
    const todayDow = today.getDay()

    // How many days until the next occurrence of that weekday
    let daysUntil = (targetDow - todayDow + 7) % 7

    const isNextWeek = /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(normalized)
    if (isNextWeek) {
      // "next <weekday>" always means the upcoming weekday in the following week.
      daysUntil += 7
    }

    const targetDate = addDays(today, daysUntil)
    targetDate.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    return {
      date_from: targetDate.toISOString(),
      date_to: endOfDay.toISOString(),
    }
  }

  // This weekend
  if (normalized.includes("weekend") || normalized.includes("this weekend")) {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // Monday
    const saturday = addDays(weekStart, 5) // Saturday
    const sunday = addDays(weekStart, 6) // Sunday
    const endOfSunday = new Date(sunday)
    endOfSunday.setHours(23, 59, 59, 999)
    return {
      date_from: saturday.toISOString(),
      date_to: endOfSunday.toISOString(),
    }
  }

  // This week
  if (normalized.includes("this week")) {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
    return {
      date_from: weekStart.toISOString(),
      date_to: weekEnd.toISOString(),
    }
  }

  // Next week
  if (normalized.includes("next week")) {
    const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1)
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 })
    return {
      date_from: nextWeekStart.toISOString(),
      date_to: nextWeekEnd.toISOString(),
    }
  }

  const explicitRange = tryParseExplicitCalendarRange(normalized)
  if (explicitRange.date_from && explicitRange.date_to) {
    return explicitRange
  }

  const monthWindow = tryParseMonthWindow(normalized, today)
  if (monthWindow.date_from && monthWindow.date_to) {
    return monthWindow
  }

  // If we can't parse, return empty
  return {}
}
