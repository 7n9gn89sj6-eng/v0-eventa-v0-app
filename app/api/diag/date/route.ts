import { NextResponse } from "next/server"
import { DateTime } from "luxon"
import { parseNaturalDate } from "@/lib/date-parser"

/**
 * Temporary diagnostic endpoint for verifying date parsing logic
 *
 * SECURITY: Gated behind DIAG_ENDPOINT=1 environment variable
 *
 * To enable in Vercel:
 * 1. Go to Project Settings → Environment Variables
 * 2. Add: DIAG_ENDPOINT=1
 * 3. Redeploy or wait for next deployment
 * 4. Test the endpoint
 * 5. REMOVE the env var when done testing
 *
 * Example response:
 * {
 *   "now": {
 *     "iso": "2025-01-12T14:30:00.000+11:00",
 *     "formatted": "Sunday, January 12, 2025 at 2:30 PM AEDT",
 *     "weekday": 7,
 *     "weekdayName": "Sunday",
 *     "offset": "UTC+11",
 *     "isDST": true
 *   },
 *   "parsedDates": {
 *     "this weekend": {
 *       "input": "this weekend",
 *       "parsed": "2025-01-18",
 *       "daysFromNow": 6,
 *       "weekday": "Saturday"
 *     },
 *     "next Monday": {
 *       "input": "next Monday",
 *       "parsed": "2025-01-13",
 *       "daysFromNow": 1,
 *       "weekday": "Monday"
 *     }
 *   },
 *   "calculations": {
 *     "currentWeekday": 7,
 *     "daysUntilSaturday": 6,
 *     "daysUntilNextMonday": 1
 *   }
 * }
 */
export async function GET() {
  // Security gate: only enable when explicitly set
  if (process.env.DIAG_ENDPOINT !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const now = DateTime.now().setZone("Australia/Melbourne")

  // Parse test phrases
  const testPhrases = ["this weekend", "next Monday", "tomorrow", "next week", "this Friday"]

  const parsedDates: Record<string, any> = {}

  for (const phrase of testPhrases) {
    const parsed = parseNaturalDate(phrase)
    if (parsed) {
      const parsedDate = DateTime.fromISO(parsed, { zone: "Australia/Melbourne" })
      const daysFromNow = Math.floor(parsedDate.diff(now, "days").days)

      parsedDates[phrase] = {
        input: phrase,
        parsed: parsed,
        daysFromNow: daysFromNow,
        weekday: parsedDate.weekdayLong,
        iso: parsedDate.toISO(),
      }
    } else {
      parsedDates[phrase] = {
        input: phrase,
        parsed: null,
        error: "Failed to parse",
      }
    }
  }

  // Calculate raw values for debugging
  const currentWeekday = now.weekday // 1=Monday, 7=Sunday
  const daysUntilSaturday = (6 - currentWeekday + 7) % 7
  const daysUntilNextMonday = currentWeekday === 7 ? 1 : (8 - currentWeekday) % 7

  return NextResponse.json({
    now: {
      iso: now.toISO(),
      formatted: now.toLocaleString(DateTime.DATETIME_FULL),
      weekday: currentWeekday,
      weekdayName: now.weekdayLong,
      offset: now.offsetNameShort,
      isDST: now.isInDST,
      zoneName: now.zoneName,
    },
    parsedDates,
    calculations: {
      currentWeekday,
      daysUntilSaturday,
      daysUntilNextMonday,
      rawWeekdayForJS: currentWeekday === 7 ? 0 : currentWeekday, // Sunday=0 for JS
    },
    meta: {
      timestamp: Date.now(),
      warning: "This is a temporary diagnostic endpoint. Disable DIAG_ENDPOINT after testing.",
    },
  })
}
