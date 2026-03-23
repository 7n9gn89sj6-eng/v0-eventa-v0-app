/**
 * Closed vocabulary for plain-language activity/context (deterministic; no place inference).
 * Parsed in app `parseSearchIntent`; used in scoring and ranking category hints.
 */
export const SEARCH_INTENT_CONTEXTS = [
  "outdoor",
  "hiking",
  "kid_friendly",
  "night",
  "farmers_market",
  "wine",
] as const

export type SearchIntentContext = (typeof SEARCH_INTENT_CONTEXTS)[number]

const RULES: { pattern: RegExp; value: SearchIntentContext }[] = [
  { pattern: /\b(hiking|hikers?|trailheads?|trails?)\b/i, value: "hiking" },
  { pattern: /\b(outdoor|open[-\s]?air)\b/i, value: "outdoor" },
  {
    pattern: /\b(kids?[-\s]?friendly|kid[-\s]?friendly|family[-\s]?friendly)\b/i,
    value: "kid_friendly",
  },
  {
    pattern: /\bnight\s+markets?\b|\bmarkets?\s+at\s+night\b|\bevening\s+markets?\b/i,
    value: "night",
  },
  { pattern: /\bfarmers?\s+markets?\b|\bfarm\s+markets?\b/i, value: "farmers_market" },
  {
    pattern: /\bfood\s+and\s+wine\b|\bwine\s+and\s+food\b|\bwine\s+tastings?\b/i,
    value: "wine",
  },
]

/**
 * Extract context tags from normalized query text (already lowercased or mixed; patterns are case-insensitive).
 */
export function extractSearchIntentContext(query: string): SearchIntentContext[] {
  const q = String(query || "").trim()
  if (!q) return []
  const seen = new Set<SearchIntentContext>()
  const out: SearchIntentContext[] = []
  for (const { pattern, value } of RULES) {
    if (!pattern.test(q) || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/**
 * Light deterministic boost when result text aligns with parsed context (cap keeps scoring stable).
 */
export function scoreContextAgainstTextBlob(
  context: readonly SearchIntentContext[] | undefined,
  blobLower: string,
): number {
  if (!context?.length) return 0
  let s = 0
  for (const c of context) {
    switch (c) {
      case "outdoor":
        if (/\b(outdoor|open\s*air|outside|park|alfresco|rooftop|garden)\b/.test(blobLower)) s += 5
        break
      case "hiking":
        if (/\b(hik(e|ing|er)|trail|trails|bushwalk|mountain)\b/.test(blobLower)) s += 6
        break
      case "kid_friendly":
        if (/\b(kids?|children|family|all\s+ages|kid[-\s]?friendly)\b/.test(blobLower)) s += 5
        break
      case "night":
        if (/\b(night|evening|late|sunset|after\s*dark|moonlight)\b/.test(blobLower)) s += 5
        break
      case "farmers_market":
        if (/\b(farmers?|farm\s+market|producer|growers?|organic)\b/.test(blobLower)) s += 6
        break
      case "wine":
        if (/\b(wine|tasting|vineyard|cellar|vintage|sommelier)\b/.test(blobLower)) s += 6
        break
      default:
        break
    }
  }
  return Math.min(14, s)
}
