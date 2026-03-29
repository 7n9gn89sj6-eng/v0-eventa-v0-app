/**
 * Conservative visible-text past dates for web results without reliable {@code startAt}.
 * Uses the same surfaces as stale-year handling (title + description + snippet), lowercased.
 */

export type VisiblePastDateStaleResult =
  | { kind: "ok" }
  | { kind: "drop" }
  /** Both parts of d/m/y (or m/d/y) are ≤12 — do not drop; penalise in ranking. */
  | { kind: "penalize" }

const MONTH_PATTERN =
  "january|february|march|april|may|june|july|august|september|october|november|december"

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

function endOfCalendarDayUtc(year: number, month0: number, day: number): Date | null {
  const d = new Date(Date.UTC(year, month0, day, 23, 59, 59, 999))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month0 || d.getUTCDate() !== day) return null
  return d
}

function endOfMonthUtc(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999))
}

/**
 * @param visibleTextLower title + description + snippet, lowercased
 */
export function evaluateVisiblePastDateStale(visibleTextLower: string, now: Date): VisiblePastDateStaleResult {
  const ends: Date[] = []
  let ambiguousNumeric = false

  for (const m of visibleTextLower.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const y = Number.parseInt(m[1]!, 10)
    const mo = Number.parseInt(m[2]!, 10) - 1
    const day = Number.parseInt(m[3]!, 10)
    const end = endOfCalendarDayUtc(y, mo, day)
    if (end) ends.push(end)
  }

  const reMonDdY = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`,
    "g",
  )
  for (const m of visibleTextLower.matchAll(reMonDdY)) {
    const mi = MONTH_INDEX[m[1]!]
    if (mi === undefined) continue
    const day = Number.parseInt(m[2]!, 10)
    const y = Number.parseInt(m[3]!, 10)
    const end = endOfCalendarDayUtc(y, mi, day)
    if (end) ends.push(end)
  }

  const reDdMonY = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\s+(20\\d{2})\\b`,
    "g",
  )
  for (const m of visibleTextLower.matchAll(reDdMonY)) {
    const day = Number.parseInt(m[1]!, 10)
    const mi = MONTH_INDEX[m[2]!]
    const y = Number.parseInt(m[3]!, 10)
    if (mi === undefined) continue
    const end = endOfCalendarDayUtc(y, mi, day)
    if (end) ends.push(end)
  }

  const reMonY = new RegExp(`\\b(${MONTH_PATTERN})\\s+(20\\d{2})\\b`, "g")
  for (const m of visibleTextLower.matchAll(reMonY)) {
    const mi = MONTH_INDEX[m[1]!]
    const y = Number.parseInt(m[2]!, 10)
    if (mi === undefined) continue
    ends.push(endOfMonthUtc(y, mi))
  }

  for (const m of visibleTextLower.matchAll(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/g)) {
    const n1 = Number.parseInt(m[1]!, 10)
    const n2 = Number.parseInt(m[2]!, 10)
    const y = Number.parseInt(m[3]!, 10)
    if (n1 > 12) {
      const end = endOfCalendarDayUtc(y, n2 - 1, n1)
      if (end) ends.push(end)
    } else if (n2 > 12) {
      const end = endOfCalendarDayUtc(y, n1 - 1, n2)
      if (end) ends.push(end)
    } else {
      ambiguousNumeric = true
    }
  }

  if (ends.length === 0) {
    return ambiguousNumeric ? { kind: "penalize" } : { kind: "ok" }
  }

  const maxEndMs = Math.max(...ends.map((d) => d.getTime()))
  if (maxEndMs < now.getTime()) {
    return { kind: "drop" }
  }

  return ambiguousNumeric ? { kind: "penalize" } : { kind: "ok" }
}
