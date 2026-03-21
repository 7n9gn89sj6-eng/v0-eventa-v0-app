import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"

/**
 * Micro-location token for CSE query shaping only when query place is explicit enough
 * to override selected scope (same bar as resolveSearchPlan). Weak/implicit place.raw
 * must not drive web queries when execution stays on the URL/picker city.
 */
export function microLocationForWebSearch(intent: SearchIntent): string | null {
  if (intent.placeEvidence !== "explicit") return null
  const raw = intent.place?.raw?.trim()
  return raw || null
}
