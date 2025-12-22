/**
 * Date overlap filtering for multi-day events
 * 
 * Ensures events that overlap with the search window are included,
 * even if they started in the past but are still ongoing.
 * 
 * Overlap rule: event.startAt <= searchEnd AND event.endAt >= searchStart
 * 
 * Examples:
 * - Long-running market (Nov 25 - Dec 24), search on Dec 20: ✅ Included (ongoing)
 * - Long-running market (Nov 25 - Dec 24), search on Dec 26: ❌ Excluded (ended)
 * - Single-day event (Dec 15), search on Dec 15: ✅ Included
 * - Future event (Jan 1), search today: ✅ Included (if overlaps search window)
 * - Past event (Nov 1 - Nov 5), search today: ❌ Excluded (ended)
 */

import { DateTime } from "luxon"

export interface DateOverlapFilter {
  startAt?: {
    lte?: Date
  }
  endAt?: {
    gte?: Date
  }
}

/**
 * Builds a Prisma where clause for date overlap filtering.
 * 
 * @param searchStart - Start of search window (defaults to now if not provided)
 * @param searchEnd - End of search window (optional, defaults to no upper bound)
 * @returns Prisma where clause that matches events overlapping the search window
 * 
 * Logic:
 * - Event overlaps if: event.startAt <= searchEnd AND event.endAt >= searchStart
 * - This means:
 *   - Events that started in the past but are still ongoing (endAt >= searchStart) are included
 *   - Events that have ended (endAt < searchStart) are excluded
 *   - Future events are included if they overlap the search window
 */
export function buildDateOverlapWhere(
  searchStart?: Date | null,
  searchEnd?: Date | null
): DateOverlapFilter {
  const now = new Date()
  const start = searchStart && searchStart > now ? searchStart : now
  
  const where: DateOverlapFilter = {}
  
  // Event must not have ended before search starts
  // event.endAt >= searchStart
  where.endAt = {
    gte: start,
  }
  
  // If searchEnd is provided, event must start before search ends
  // event.startAt <= searchEnd
  if (searchEnd) {
    where.startAt = {
      lte: searchEnd,
    }
  }
  
  return where
}

/**
 * Builds a date overlap filter with explicit start and end dates.
 * Useful when you have a specific date range from user query.
 * 
 * @param startDate - Start of search window
 * @param endDate - End of search window
 * @returns Prisma where clause for date overlap
 */
export function buildDateRangeOverlapWhere(
  startDate: Date,
  endDate: Date
): DateOverlapFilter {
  return {
    startAt: {
      lte: endDate, // Event starts before search window ends
    },
    endAt: {
      gte: startDate, // Event ends after search window starts
    },
  }
}

