/**
 * Tier 1 plain-language helpers: leading instruction stripping and text-layer stopwords.
 * No LLM; shared by parseSearchIntent and /api/search/events.
 */

/** Longest / most specific first; one match stripped per outer iteration. */
const LEADING_INSTRUCTION_PREFIXES: RegExp[] = [
  /^(looking\s+for|searching\s+for|search\s+for|look\s+for)\s+/i,
  /^(show\s+me|give\s+me|get\s+me)\s+/i,
  /^can\s+you\s+/i,
  /^(i\s+want|i\s+need)\s+/i,
  /^find\s+/i,
  /^search\s+/i,
  /^show\s+/i,
  /^give\s+/i,
  /^get\s+/i,
  /^list\s+/i,
  /^please\s+/i,
  /^want\s+/i,
  /^need\s+/i,
]

/**
 * Strip leading instructional / noise phrases so place/time/interest parsers see the core query.
 */
export function normalizeSearchUtterance(input: string): string {
  let s = String(input || "")
    .trim()
    .replace(/\s+/g, " ")
  if (!s) return s

  while (true) {
    const before = s
    for (const re of LEADING_INSTRUCTION_PREFIXES) {
      const next = s.replace(re, "").trim().replace(/\s+/g, " ")
      if (next !== s) {
        s = next
        break
      }
    }
    if (s === before) break
  }
  return s
}

/** Multi-word Australian admin areas; matched as suffix token sequences (lowercase). */
const AU_STATE_MULTIWORD_SUFFIXES: string[][] = [
  ["australian", "capital", "territory"],
  ["new", "south", "wales"],
  ["northern", "territory"],
  ["south", "australia"],
  ["western", "australia"],
]

const AU_STATE_SINGLE_TOKENS = new Set([
  "victoria",
  "vic",
  "nsw",
  "qld",
  "queensland",
  "sa",
  "wa",
  "tas",
  "tasmania",
  "nt",
  "act",
])

/**
 * When country is Australia, drop trailing state/territory tokens from a multi-token city
 * (e.g. "Brunswick Victoria" → "Brunswick"). Single-token cities unchanged.
 */
export function stripTrailingAustralianStateTokens(city: string): string {
  const tokens = city.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return city

  while (tokens.length >= 2) {
    let changed = false
    for (const mw of AU_STATE_MULTIWORD_SUFFIXES) {
      if (tokens.length < mw.length) continue
      const tail = tokens.slice(-mw.length).map((t) => t.toLowerCase().replace(/[.,]/g, ""))
      if (tail.every((t, i) => t === mw[i])) {
        tokens.splice(-mw.length)
        changed = true
        break
      }
    }
    if (changed) continue

    const last = tokens[tokens.length - 1].toLowerCase().replace(/[.,]/g, "")
    if (AU_STATE_SINGLE_TOKENS.has(last)) {
      tokens.pop()
      continue
    }
    break
  }

  return tokens.length ? tokens.join(" ") : city
}

/** Longest phrases first for whole-phrase removal in the text-matching layer. */
const TEXT_SEARCH_STOPWORD_PHRASES = [
  "looking for",
  "searching for",
  "search for",
  "look for",
  "show me",
  "give me",
  "get me",
  "can you",
  "i want",
  "i need",
]

const TEXT_SEARCH_STOPWORD_SINGLE_REGEX =
  /\b(?:search|find|show|give|get|list|me|please|the|a|an|in|at|on|for|to|near|around|of|with)\b/gi

/**
 * Remove glue / instruction tokens so they do not become mandatory AND term groups.
 * Call only after structured city (and similar) has been removed from the query string.
 */
export function stripTextSearchStopwords(textQuery: string): string {
  let s = String(textQuery || "")
    .trim()
    .replace(/\s+/g, " ")
  if (!s) return s

  for (const phrase of TEXT_SEARCH_STOPWORD_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi")
    s = s.replace(re, " ")
  }
  s = s.replace(TEXT_SEARCH_STOPWORD_SINGLE_REGEX, " ")
  return s.replace(/\s+/g, " ").trim()
}
