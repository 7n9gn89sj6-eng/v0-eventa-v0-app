/**
 * Ranking / legacy entry: delegates to app `parseSearchIntent` so category hint and context
 * stay aligned with execution intent (single source of truth).
 */

import {
  parseSearchIntent as parseFullSearchIntent,
  rankingCategoryFromParsedIntent,
  type SearchIntent,
} from "@/app/lib/search/parseSearchIntent"
import type { SearchIntentContext } from "@/lib/search/search-intent-context"

export type { SearchIntentContext }

export interface ParsedSearchIntent {
  detectedCategory?: string
  context: SearchIntentContext[]
}

export function parseSearchIntent(query: string): ParsedSearchIntent {
  const full: SearchIntent = parseFullSearchIntent(query)
  return {
    detectedCategory: rankingCategoryFromParsedIntent(full),
    context: full.context ?? [],
  }
}

/** Use when you already have a full `SearchIntent` (e.g. search route). */
export function parsedIntentToRankingHint(intent: SearchIntent): ParsedSearchIntent {
  return {
    detectedCategory: rankingCategoryFromParsedIntent(intent),
    context: intent.context ?? [],
  }
}
