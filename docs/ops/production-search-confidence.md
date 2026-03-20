# Production confidence — Eventa search

Runbook for trusting `/api/search/events` after deploy. Complements [post-publish-checklist.md](./post-publish-checklist.md).

---

## 1. Preconditions

| Item | Notes |
|------|--------|
| **Automated trust** | Before merge/deploy: `npx vitest run tests/eventa-search-trust` — all green. |
| **Web fallback** | `GOOGLE_API_KEY` + `GOOGLE_PSE_ID` set in production if you expect CSE results when internal is empty ([README](../../README.md)). |
| **AI intent** | Optional interpreter: `EVENTA_ENABLE_AI_INTENT=true` only when `OPENAI_API_KEY` is set; deterministic intent still drives the plan. |

---

## 2. Product doctrine (for manual checks)

- **Global scope** is intentional only: **`anywhere`**, **`worldwide`**, **`global`** in the query. Words like “world” or “international” alone do **not** widen scope.
- **Broad discovery** phrases (`what's on`, `things to do`, bare `events` without `in …`) stay **broad** (no strict category collapse) when scope rules say so.
- **Scope-only tokens** are not required to appear in event text (aligned with route text cleaning).

---

## 3. Post-deploy smoke — `/api/search/events`

Replace `BASE` with your production origin (no trailing slash). Use a **real** UI location via `city` / `country` where noted.

### 3.1 Health-shaped checks

```bash
BASE=https://your-app.example.com

# JSON shape + 200
curl -sS "$BASE/api/search/events?query=music&city=Melbourne&country=Australia" | head -c 2000
```

Confirm the payload includes: `events`, `internal`, `external`, `effectiveLocation`, `emptyState`, `includesWeb`, `isEventIntent` (names may vary slightly if the client strips fields — use raw API).

### 3.2 Stabilisation-aligned queries (quick)

Run with `city`/`country` set to your default test market (e.g. Melbourne / Australia):

| Query (URL-encoded) | What to expect |
|---------------------|----------------|
| `what%27s%20on%20this%20weekend` | `effectiveLocation.scope` is **`broad`** (not forced to a bogus city from “what's on”). |
| `music%20festivals%20anywhere` | `effectiveLocation.scope` is **`global`**; results may span multiple countries when data/web allow; UI city must not dominate the plan. |
| `events%20worldwide` | Same global idea; `effectiveLocation.city` null. |
| `live%20music%20Melbourne` with `city=Sydney` | Query place wins: internals skew **Melbourne**, not Sydney. |

### 3.3 Regression signals

| Signal | Action if wrong |
|--------|------------------|
| `emptyState: true` everywhere for normal queries | Check DB events, dates, `PUBLIC_EVENT_WHERE`, web config. |
| `includesWeb: false` always when internal is empty | Check Google env vars and route logs for web path. |
| Global queries still filtered to one city | Scope / plan regression — compare with trust tests. |

---

## 4. Logs (optional)

In Vercel (or your host), filter for `[v0]` lines from `app/api/search/events/route.ts` when debugging a single query: final where clause, location, web decision.

---

## Known expected ambiguities

- **Expected vs regression:** The bullets below describe **intentional** behaviour. Treat as a **regression** only when the trust suite fails, §3.3 signals trip for queries that used to work with the same data/env, or explicit global queries (`anywhere` / `worldwide` / `global`) no longer get global scope.

- **Global vs non-global wording**
  - `world music festivals`, `international film festivals` → **not** global; normal local/UI location rules apply.
  - Only **`anywhere`**, **`worldwide`**, **`global`** in the query trigger **global** scope.
  - Do **not** expect global results from “world” or “international” alone.

- **Time-of-day language**
  - `morning`, `afternoon`, `evening` → **not** strict time-window filters in search planning.
  - They may affect ranking or be ignored; day-level parsing (e.g. a named weekday) dominates when present.

- **Broad intent language**
  - `something fun`, `something interesting` → rely on **ranking**, **metadata**, and **web** results more than on tight structured filters.
  - Sparse or uneven results can be normal; compare to trust tests and recent prod before escalating.

---

## 5. Rollback / pause criteria

- Spike in **5xx** on `/api/search/events`.
- **Empty** search for previously good queries with **no** change in data or env.
- Trust suite **fails** on `main` after a search-related merge — treat as deploy blocker for search-critical releases.

---

## 6. Related

- Trust tests: `tests/eventa-search-trust/`
- General smoke: `npm run smoke:prod` ([post-publish-checklist.md](./post-publish-checklist.md))
