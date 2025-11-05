import { DateTime } from "luxon"

const MELBOURNE_TZ = "Australia/Melbourne"

// Multilingual date normalization
function normalizeMultilingualDate(phrase: string): string {
  const normalized = phrase.toLowerCase().trim()

  const translations: Record<string, string> = {
    // Italian
    oggi: "today",
    domani: "tomorrow",
    "questo fine settimana": "this weekend",
    "prossimo mese": "next month",
    lunedì: "monday",
    martedì: "tuesday",
    mercoledì: "wednesday",
    giovedì: "thursday",
    venerdì: "friday",
    sabato: "saturday",
    domenica: "sunday",
    // Greek
    σήμερα: "today",
    αύριο: "tomorrow",
    δευτέρα: "monday",
    τρίτη: "tuesday",
    τετάρτη: "wednesday",
    πέμπτη: "thursday",
    παρασκευή: "friday",
    σάββατο: "saturday",
    κυριακή: "sunday",
    // Spanish
    hoy: "today",
    mañana: "tomorrow",
    lunes: "monday",
    martes: "tuesday",
    miércoles: "wednesday",
    jueves: "thursday",
    viernes: "friday",
    sábado: "saturday",
    domingo: "sunday",
    // French
    "aujourd'hui": "today",
    demain: "tomorrow",
    lundi: "monday",
    mardi: "tuesday",
    mercredi: "wednesday",
    jeudi: "thursday",
    vendredi: "friday",
    samedi: "saturday",
    dimanche: "sunday",
  }

  return translations[normalized] || phrase
}

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

  if (lowerPhrase === "today") {
    return melbourneNow.toISODate()
  }

  if (lowerPhrase === "tomorrow") {
    return melbourneNow.plus({ days: 1 }).toISODate()
  }

  const dayMatch = lowerPhrase.match(/(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)
  if (dayMatch) {
    const [, modifier, dayName] = dayMatch
    const targetDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(
      dayName.toLowerCase(),
    )
    const currentDay = melbourneNow.weekday === 7 ? 0 : melbourneNow.weekday

    let daysToAdd = targetDay - currentDay
    if (modifier === "next" || daysToAdd <= 0) {
      daysToAdd += 7
    }

    return melbourneNow.plus({ days: daysToAdd }).toISODate()
  }

  if (lowerPhrase.includes("this weekend")) {
    const currentDay = melbourneNow.weekday % 7
    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7
    return melbourneNow.plus({ days: daysUntilSaturday }).toISODate()
  }

  if (lowerPhrase.includes("next month")) {
    return melbourneNow.plus({ months: 1 }).startOf("month").toISODate()
  }

  return null
}

export function parseTime(timeStr: string): string | null {
  const cleaned = timeStr.toLowerCase().trim()
  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return null

  let hours = Number.parseInt(match[1])
  const minutes = match[2] ? Number.parseInt(match[2]) : 0
  const meridiem = match[3]

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  if (hours < 0 || minutes < 0) return null
  if (minutes > 59) return null

  if (meridiem) {
    if (hours < 1 || hours > 12) return null
  } else {
    if (hours > 23) return null
  }

  if (meridiem === "pm" && hours < 12) hours += 12
  if (meridiem === "am" && hours === 12) hours = 0

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

export function detectTimeConflicts(input: string): string[] | null {
  const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi
  const matches = [...input.matchAll(timePattern)]

  if (matches.length <= 1) return null

  const times = matches.map((m) => parseTime(m[0])).filter(Boolean) as string[]
  const uniqueTimes = [...new Set(times)]

  return uniqueTimes.length > 1 ? uniqueTimes : null
}

export function isPastDateTime(dateISO: string, time24h: string): boolean {
  const eventDateTime = DateTime.fromISO(`${dateISO}T${time24h}:00`, { zone: MELBOURNE_TZ })
  const now = getMelbourneNow()
  return eventDateTime < now
}

export const parseNaturalDate = parseDatePhrase
