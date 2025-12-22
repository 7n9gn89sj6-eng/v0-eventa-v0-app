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
      // Single day: use the date as both from and to
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      params.set("date_from", startOfDay.toISOString())
      params.set("date_to", endOfDay.toISOString())
    }
  } else if (extracted.date) {
    const dateRange = parseDateExpression(extracted.date)
    if (dateRange.date_from) {
      params.set("date_from", dateRange.date_from)
    }
    if (dateRange.date_to) {
      params.set("date_to", dateRange.date_to)
    }
  }

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

  // If we can't parse, return empty
  return {}
}
