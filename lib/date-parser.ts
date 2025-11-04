import { DateTime } from "luxon"
import { normalizeMultilingualDate } from "./i18n/date-tokens"

const MELBOURNE_TZ = "Australia/Melbourne"

// Get current time in Melbourne timezone
function getMelbourneNow(): DateTime {
  return DateTime.now().setZone(MELBOURNE_TZ)
}

export function parseDatePhrase(phrase: string): string | null {
  const melbourneNow = getMelbourneNow()

  const normalized = normalizeMultilingualDate(phrase)
  const lowerPhrase = normalized.toLowerCase().trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  // Today
  if (lowerPhrase === "today") {
    return melbourneNow.toISODate()
  }

  // Tomorrow
  if (lowerPhrase === "tomorrow") {
    return melbourneNow.plus({ days: 1 }).toISODate()
  }

  // This/Next + Day of week
  const dayMatch = lowerPhrase.match(/(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)
  if (dayMatch) {
    const [, modifier, dayName] = dayMatch
    const targetDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(
      dayName.toLowerCase(),
    )
    const currentDay = melbourneNow.weekday % 7 // Luxon uses 1-7 (Mon-Sun), convert to 0-6 (Sun-Sat)

    let daysToAdd = targetDay - currentDay
    if (modifier === "next" || daysToAdd <= 0) {
      daysToAdd += 7
    }

    return melbourneNow.plus({ days: daysToAdd }).toISODate()
  }

  // This weekend (Saturday)
  if (lowerPhrase.includes("this weekend")) {
    const currentDay = melbourneNow.weekday % 7
    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7
    return melbourneNow.plus({ days: daysUntilSaturday }).toISODate()
  }

  // Next month (first day)
  if (lowerPhrase.includes("next month")) {
    return melbourneNow.plus({ months: 1 }).startOf("month").toISODate()
  }

  return null
}

// Parse time to 24h format
export function parseTime(timeStr: string): string | null {
  const cleaned = timeStr.toLowerCase().trim()

  // Match patterns like "8pm", "8:30pm", "20:00", "8:30 pm"
  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return null

  let hours = Number.parseInt(match[1])
  const minutes = match[2] ? Number.parseInt(match[2]) : 0
  const meridiem = match[3]

  if (meridiem === "pm" && hours < 12) hours += 12
  if (meridiem === "am" && hours === 12) hours = 0

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

// Detect conflicting times in input
export function detectTimeConflicts(input: string): string[] | null {
  const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi
  const matches = [...input.matchAll(timePattern)]

  if (matches.length <= 1) return null

  const times = matches.map((m) => parseTime(m[0])).filter(Boolean) as string[]
  const uniqueTimes = [...new Set(times)]

  return uniqueTimes.length > 1 ? uniqueTimes : null
}

// Helper to check if a date/time is in the past (Melbourne timezone)
export function isPastDateTime(dateISO: string, time24h: string): boolean {
  const eventDateTime = DateTime.fromISO(`${dateISO}T${time24h}:00`, { zone: MELBOURNE_TZ })
  const now = getMelbourneNow()
  return eventDateTime < now
}
