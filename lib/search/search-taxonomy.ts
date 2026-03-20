/**
 * Search taxonomy: phrase and word synonyms for query expansion.
 * Phrase-level expansion supports "garage sale", "live music", "art show" etc.
 */

/** Synonyms for multi-word phrases (matched against raw normalized query first, longest first). */
export const PHRASE_SYNONYMS: Record<string, string[]> = {
  "garage sale": ["markets", "community sale", "yard sale", "flea"],
  "live music": ["music", "gig", "concert", "performance"],
  "art show": ["art", "exhibition", "gallery"],
  "flea market": ["market", "markets", "bazaar", "fair"],
  "christmas market": ["xmas", "christmas", "markets", "noel", "navidad"],
  "xmas market": ["christmas", "markets", "noel", "navidad"],
}

/** Synonyms for single words (used for tokens not part of a matched phrase). */
export const WORD_SYNONYMS: Record<string, string[]> = {
  xmas: ["christmas", "x-mas", "noel", "navidad", "natal"],
  christmas: ["xmas", "x-mas", "noel", "navidad", "natal"],
  market: ["markets", "flea market", "bazaar", "fair", "fiesta"],
  markets: ["market", "flea market", "bazaar", "fair", "fiesta"],
  gig: ["music", "live music", "concert"],
  concert: ["music", "gig", "live music"],
  exhibition: ["art", "art show", "gallery"],
  gallery: ["art", "art show", "exhibition"],
  festival: ["festivals", "fest"],
  festivals: ["festival", "fest"],
}

/**
 * Normalizes query for phrase/word extraction: lower case, trim, collapse spaces.
 */
function normalizeForExpansion(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Extracts phrase and word tokens from the raw normalized query.
 * Phrases are matched longest-first so "garage sale" is taken before "sale".
 */
function extractTokens(normalizedQuery: string): string[] {
  const phrases = Object.keys(PHRASE_SYNONYMS).sort((a, b) => b.length - a.length)
  let remaining = normalizedQuery
  const tokens: string[] = []

  for (const phrase of phrases) {
    const re = new RegExp(phrase.replace(/\s+/g, "\\s+"), "gi")
    let match: RegExpExecArray | null
    while ((match = re.exec(remaining)) !== null) {
      tokens.push(phrase)
    }
    remaining = remaining.replace(re, " ").trim()
  }

  const words = remaining.split(/\s+/).filter(Boolean)
  tokens.push(...words)
  return tokens
}

/**
 * Returns expanded term groups from the raw normalized query.
 * Each group is [term, ...synonyms]; we AND across groups and OR within each group.
 * Supports phrase-level matches (e.g. "garage sale", "live music", "art show").
 *
 * @param normalizedQuery - Already cleaned query (e.g. trimmed, collapsed spaces)
 * @returns Array of term groups; each group is an array of strings to OR together
 */
export function getExpandedTermGroups(normalizedQuery: string): string[][] {
  const normalized = normalizeForExpansion(normalizedQuery)
  if (!normalized) return []

  const tokens = extractTokens(normalized)
  return tokens.map((token) => {
    const phraseSyns = PHRASE_SYNONYMS[token]
    const wordSyns = WORD_SYNONYMS[token]
    const synonyms = phraseSyns ?? wordSyns ?? []
    return [token, ...synonyms]
  })
}
