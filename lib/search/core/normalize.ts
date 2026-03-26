/**
 * Canonical query shaping for GET /api/search/events (param + utterance cleanup).
 * Re-exports existing implementations — single import path for the canonical route.
 */

export { sanitizeQueryParam } from "@/lib/search/sanitize-query-param"
export { repairDiscoveryPhrases } from "@/lib/search/discovery-phrase-repair"
export { normalizeSearchUtterance, stripTextSearchStopwords } from "@/lib/search/normalize-search-utterance"
