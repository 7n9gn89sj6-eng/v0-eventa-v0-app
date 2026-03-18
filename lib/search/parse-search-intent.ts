/**
 * Lightweight search intent parsing for ranking (e.g. category boost).
 * Does not assume events have a single category; used only to detect query intent.
 */

export interface ParsedSearchIntent {
  /** Detected category keyword for ranking boost (e.g. "music", "markets", "arts"). */
  detectedCategory?: string
}

const CATEGORY_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(garage\s+sale|flea\s+market|market|markets|bazaar|fair)\b/i, category: "markets" },
  { pattern: /\b(live\s+music|music|gig|concert|band|dj)\b/i, category: "music" },
  { pattern: /\b(art\s+show|art|exhibition|gallery|theatre|theater)\b/i, category: "arts" },
  { pattern: /\b(food|eat|drink|wine|beer|restaurant)\b/i, category: "food" },
  { pattern: /\b(sport|fitness|outdoor|run|yoga)\b/i, category: "sports" },
  { pattern: /\b(family|kids|children)\b/i, category: "family" },
  { pattern: /\b(community|volunteer|charity)\b/i, category: "community" },
  { pattern: /\b(learn|talk|workshop|course)\b/i, category: "learning" },
]

/**
 * Parses search query for intent (e.g. category) for use in ranking only.
 */
export function parseSearchIntent(query: string): ParsedSearchIntent {
  if (!query || !query.trim()) return {}
  const q = query.trim()
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(q)) return { detectedCategory: category }
  }
  return {}
}
