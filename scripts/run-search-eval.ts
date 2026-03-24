/**
 * Lightweight search evaluation harness: calls /api/search/events and emits JSON for human review.
 *
 * Usage:
 *   SEARCH_EVAL_BASE_URL=http://localhost:3000 tsx scripts/run-search-eval.ts
 *   SEARCH_EVAL_BASE_URL=https://staging.example.com tsx scripts/run-search-eval.ts --id disc-01
 *
 * Output: one JSON object per line (JSONL) to stdout; redirect to a file for diffing runs.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type PackQuery = {
  id: string
  bucket: string
  q: string
  params?: Record<string, string>
}

type Pack = { version: number; queries: PackQuery[] }

const packPath = resolve(process.cwd(), "tests/search-eval/evaluation-pack.json")
const baseUrl = (process.env.SEARCH_EVAL_BASE_URL || "http://localhost:3000").replace(/\/$/, "")

function loadPack(): Pack {
  const raw = readFileSync(packPath, "utf8")
  return JSON.parse(raw) as Pack
}

function buildSearchUrl(q: string, extra: Record<string, string> = {}): string {
  const u = new URL("/api/search/events", baseUrl)
  u.searchParams.set("q", q)
  u.searchParams.set("debug", "1")
  u.searchParams.set("take", "20")
  for (const [k, v] of Object.entries(extra)) {
    if (v) u.searchParams.set(k, v)
  }
  return u.toString()
}

async function main() {
  const pack = loadPack()
  const onlyId = process.argv.includes("--id") ? process.argv[process.argv.indexOf("--id") + 1] : null
  const queries = onlyId ? pack.queries.filter((x) => x.id === onlyId) : pack.queries

  if (queries.length === 0) {
    console.error("No queries matched (check --id).")
    process.exit(1)
  }

  for (const row of queries) {
    const params = row.params ?? {}
    const url = buildSearchUrl(row.q, params)
    const started = Date.now()
    let payload: unknown
    let httpStatus = 0
    let error: string | null = null
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } })
      httpStatus = res.status
      payload = await res.json()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const elapsedMs = Date.now() - started

    const body = payload as Record<string, unknown> | undefined
    const events = (body?.events as Record<string, unknown>[]) || []
    const top5 = events.slice(0, 5).map((e, i) => ({
      rank: i + 1,
      source: e.source === "web" ? "web" : "internal",
      title: String(e.title ?? "").slice(0, 200),
      urlOrId: String(e.externalUrl ?? e.id ?? ""),
      city: e.city != null ? String(e.city) : null,
      startAt: e.startAt != null ? String(e.startAt) : null,
      genericWebPenalty:
        e.source === "web" && (e as { _rankBreakdown?: { genericWebPenalty?: number } })._rankBreakdown
          ? (e as { _rankBreakdown: { genericWebPenalty?: number } })._rankBreakdown.genericWebPenalty ??
            null
          : null,
    }))

    const internalN = events.filter((e) => e.source !== "web").length
    const webN = events.filter((e) => e.source === "web").length
    const top5Internal = top5.filter((t) => t.source === "internal").length
    const top5Web = top5.filter((t) => t.source === "web").length

    const record = {
      queryId: row.id,
      bucket: row.bucket,
      q: row.q,
      url,
      httpStatus,
      elapsedMs,
      error,
      counts: { total: events.length, internal: internalN, web: webN },
      mix: { top5Internal, top5Web },
      top5,
      debugTrace: body?.debugTrace ?? null,
      reviewTemplate: {
        scores: {
          exactness: null,
          geoAccuracy: null,
          timeRelevance: null,
          hubNoise: null,
        },
        reviewerNotes: "",
      },
    }
    console.log(JSON.stringify(record))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
