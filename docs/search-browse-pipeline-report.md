# Event search/browse pipeline – verification report

## 1. Full search/browse flow (in order)

| Entry point | Component | API called | Params |
|-------------|-----------|------------|--------|
| **Homepage** | No event listing; `SmartInputBar` only. Search submits → `/api/search/intent` then navigates to `/discover?q=...&city=...` | (no direct event fetch on homepage) | — |
| **/events** | `EventsListingContent` | **GET /api/search/events** | `query`, `city`, `country`, `category`, `date_from`, `date_to` (from URL or `defaultLocation`) |
| **/discover** | `EventsListingContent` (same) | **GET /api/search/events** | Same as above; `q` often set from search |
| **Search results** | Same listing after SmartInputBar → navigate to `/discover` | **GET /api/search/events** | Query + optional city/country from intent or defaultLocation |
| **Browse** | Same `EventsListingContent`; “browse” = no query, optional filters | **GET /api/search/events** | No `query`; optional `city`, `country`, `category`, `date_*` |

**Single API for listing:** `GET /api/search/events` (used by /events, /discover, and after search).

---

## 2. What the API does

- **First thing it does:** Builds a Prisma `where` (with `PUBLIC_EVENT_WHERE` + location/date/category/text). **If there is no query and no filters**, it **returns empty** immediately (see below) and does **not** hit the DB.
- **Otherwise:** It **queries the internal DB first** (`prisma.event.findMany` with that `where`), then optionally runs web search.
- **Internal DB:** Always used when there is a query **or** at least one filter (city, country, category, date). `where` includes:
  - `PUBLIC_EVENT_WHERE` → `status: "PUBLISHED"`, `moderationStatus: "APPROVED"`
  - Optional: city (contains), country (contains), date overlap, category, text search (when `q` present).
- **External/web:** Fetched only when `shouldSearchWeb` is true (e.g. event-intent query with location and no internal results, or non–event-intent query). Merged **after** internal results.
- **Ranking/sorting:**
  - **Internal:** Sorted by city match (if city filter) then by `startAt`; otherwise by `startAt` only.
  - **External:** Event-first ranking (e.g. `rankEventResults`). Internal list is built first, then external appended.

---

## 3. Are user-created (internal) events prioritized?

**Yes, in the response.**  
The API builds:

- `allEvents = [...internalEvents, ...externalEvents]`  
and returns `internal` and `external` separately; the client also concatenates internal then external. So **internal DB events always come first** when they are returned.

**But:** Internal events are **only** returned when the API actually runs the DB path. When there is **no query and no filters**, the API returns **empty** (no DB query), so **no** internal events are returned and nothing is “prioritized.”

---

## 4. Can internal DB events be hidden?

| Factor | Can hide internal events? | How |
|--------|----------------------------|-----|
| **City filter** | Yes | `where.city = { contains: city, mode: "insensitive" }`. Mismatch (e.g. event city "BRUNSWICK EAST", filter "Melbourne") excludes the event. |
| **defaultLocation.city** | Yes | Client sends `city = cityFilter \|\| defaultLocation?.city`. So if user has defaultLocation (e.g. Melbourne), city is sent and internal events are filtered by city. |
| **Date filtering** | Yes | Overlap logic; events outside the range are excluded. |
| **Moderation** | Yes | `PUBLIC_EVENT_WHERE` requires `status: "PUBLISHED"` and `moderationStatus: "APPROVED"`. |
| **Pagination** | Yes | `take` / `skip`; internal events beyond the page are not returned. |
| **Ranking** | No | Internal list is not re-ordered with external; internal always first. |
| **No query + no filters** | Yes (all internal) | Early return returns empty; DB is never queried, so **all** internal events are effectively hidden on “browse” with no filters. |

---

## 5. Exact ordering logic

- **Internal first, external second:**  
  `allEvents = [...internalEvents, ...externalEvents]` (API and client).
- **Internal order:**  
  If city filter: sort by city match then by `startAt`; else sort by `startAt` only.
- **External order:**  
  Event-first ranking (scores, then sort); no mixing with internal by score.
- **No client-side reordering** that mixes internal with external; client may sort the combined list (e.g. by date) but still receives internal first from the API.

---

## 6. Example: “Garage Sale”, BRUNSWICK EAST, PUBLISHED, APPROVED

- **Homepage:** No event listing; this event does not “appear” there (only search bar).
- **/events with no location/search:**  
  Client calls `/api/search/events` with no `query`, no `city`/`country` (if no defaultLocation). API hits the **early return** and returns **empty**. So this event **does not appear**.
- **/events with city = “Brunswick East” (or “Brunswick”):**  
  DB is queried with city filter; event can match and appear (internal first).
- **/events with defaultLocation.city = “Melbourne”:**  
  City filter is “Melbourne”; event city “BRUNSWICK EAST” does not contain “Melbourne”, so event is **excluded** from internal results.
- **Search results:**  
  Same API; if the request has no params, again empty. If there is a query and/or matching filters, internal events (including this one when filters match) appear first.

**Conclusion:** With **no explicit location filter** and no query, the event **does not** appear on homepage (no list), and **does not** appear on /events or /discover because the API returns empty for that case.

---

## 7. Minimal production-safe fix (proposed, not applied)

**Goal:**  
Always query the internal DB for public events when the user is “browsing” (no query, no filters), and keep internal events first and external as enrichment.

**Root cause:**  
The early return when `!q && !city && !category && !dateFrom && !dateTo` skips the DB and returns empty, so browse-with-no-filters shows no internal events.

**Change:**  
Remove the early return so that when there is no query we still enter the existing `if (!q)` branch. That branch already:

- Builds `where = { ...PUBLIC_EVENT_WHERE }`
- Adds optional city, country, date, category
- When none are set, only adds the default date overlap (events ending after `now`)
- Runs `prisma.event.findMany` and returns `internal: events`, `external: []`

So with no params we get “all public, not-ended events” from the DB, with no web search. Internal events are still returned first; external remain secondary (and in this path, none).

**Exact diff (proposed):**

**File:** `app/api/search/events/route.ts`

```diff
   try {
-    // If no query and no filters, return empty
-    if (!q && !city && !category && !dateFrom && !dateTo) {
-      return NextResponse.json({
-        events: [],
-        count: 0,
-        page: 1,
-        take,
-        internal: [],
-        external: [],
-        total: 0,
-        emptyState: false,
-        includesWeb: false,
-        isEventIntent: false,
-      })
-    }
-
     if (!q) {
```

**Effect:**

- **Browse with no filters** (e.g. /events with no query, no city/country/date/category): API no longer returns empty; it queries the DB with `PUBLIC_EVENT_WHERE` + default date overlap and returns those internal events. “Garage Sale” (PUBLISHED, APPROVED, endAt in future) can appear.
- Internal events remain first; external only when `shouldSearchWeb` runs (query present, etc.). No change to ranking or to when web is called.
- Safe: same `where` and pagination as the existing `if (!q)` branch; only the early exit is removed.

---

## 8. Affected files (for the fix)

| File | Role |
|------|------|
| `app/api/search/events/route.ts` | Remove early return so browse-with-no-filters hits DB and returns internal events first. |
| (optional) `components/events/events-listing-content.tsx` | No change required for “internal first”; it already concatenates `data.internal` then `data.external`. |

---

## 9. Summary

- **Flow:** Homepage has no event list; /events and /discover both use `EventsListingContent` → **GET /api/search/events**.
- **API:** Queries internal DB first when it doesn’t return early; merges external only when `shouldSearchWeb`; returns **internal first, then external**.
- **Current gap:** When there is **no query and no filters**, the API returns **empty** and never queries the DB, so user-created events (e.g. “Garage Sale” in BRUNSWICK EAST) do not appear on /events or /discover.
- **Minimal fix:** Remove the early return in `app/api/search/events/route.ts` so that “no query, no filters” still runs the existing `if (!q)` browse path (DB with `PUBLIC_EVENT_WHERE` + date overlap, internal only). Internal events stay first; external remain secondary enrichment.
