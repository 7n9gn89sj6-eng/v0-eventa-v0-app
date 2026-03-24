/**
 * Dedupe / merge logic is **not** unified yet. Known implementations:
 *
 * - **GET /api/search/events** — inline URL-key merge + scored merge (see route).
 * - **POST /api/search** — `deduplicateResults` in `lib/search/web-search.ts` (title + URL path).
 * - **POST /api/search/dual** — local `deduplicateResults` + Levenshtein on title/date/venue.
 *
 * Next consolidation step: extract one strategy here and migrate **only** `/api/search/events`
 * when legacy routes are removed (do not share with legacy without deleting them first).
 */

export {}
