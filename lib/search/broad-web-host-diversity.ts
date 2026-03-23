/**
 * Broad-query only: same-host web stacking reduced via diversityPenalty + stable re-sort.
 * Internals unchanged; equal effectiveScore ties break by original list order (_preDiversityIndex).
 */

export type BroadDiversityRow = {
  _score: number
  _resultKind?: string
  externalUrl?: string
  _originalUrl?: string
  url?: string
  startAt?: string | Date
  title?: string
  id?: string
  [key: string]: unknown
}

/** diversityPenalty = hostOccurrenceIndex * DIVERSITY_K (index 0 → no penalty). */
const DIVERSITY_K = 3
const TOP_SLOTS_SOFTEN = 2
const TOP_SLOT_FACTOR = 0.25

/**
 * Prefer `url`, then externalUrl / _originalUrl. Uses new URL(...).hostname; never throws.
 */
function hostnameFromWebRow(r: BroadDiversityRow): string {
  const candidates = [r.url, r.externalUrl, r._originalUrl]
  for (const raw of candidates) {
    const u = String(raw ?? "").trim()
    if (!u) continue
    try {
      const href = u.startsWith("http://") || u.startsWith("https://") ? u : `https://${u}`
      let h = new URL(href).hostname.toLowerCase()
      if (h.startsWith("www.")) h = h.slice(4)
      if (h) return h
    } catch {
      /* try next candidate */
    }
  }
  return "(unknown)"
}

/**
 * Returns a new array sorted by `_effectiveRankScore` (desc), stable on ties.
 * Web: `_diversityPenalty`, `_effectiveRankScore`, `_diversityHost`, `_hostOccurrenceIndex`, `_preDiversityIndex`.
 * Internal: `_effectiveRankScore === _score`, `_preDiversityIndex` only.
 */
export function applyBroadWebHostDiversity(rows: BroadDiversityRow[]): BroadDiversityRow[] {
  if (rows.length === 0) return rows

  const hostCounts = new Map<string, number>()
  const annotated = rows.map((r, preIdx) => {
    const base = { ...r, _preDiversityIndex: preIdx }
    if (r._resultKind !== "web") {
      return { ...base, _effectiveRankScore: r._score }
    }

    const host = hostnameFromWebRow(r)
    const occurrenceIndex = hostCounts.get(host) ?? 0
    hostCounts.set(host, occurrenceIndex + 1)

    let diversityPenalty = occurrenceIndex * DIVERSITY_K
    if (preIdx < TOP_SLOTS_SOFTEN) {
      diversityPenalty = Math.floor(diversityPenalty * TOP_SLOT_FACTOR)
    }

    const effective = r._score - diversityPenalty
    return {
      ...base,
      _diversityPenalty: diversityPenalty,
      _effectiveRankScore: effective,
      _diversityHost: host,
      _hostOccurrenceIndex: occurrenceIndex,
    }
  })

  return [...annotated].sort((a: any, b: any) => {
    const ea = a._effectiveRankScore ?? a._score
    const eb = b._effectiveRankScore ?? b._score
    if (eb !== ea) return eb - ea
    try {
      const ta = new Date(a.startAt as string).getTime()
      const tb = new Date(b.startAt as string).getTime()
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb
    } catch {
      /* ignore */
    }
    const sa = a._resultKind === "internal" ? 0 : 1
    const sb = b._resultKind === "internal" ? 0 : 1
    if (sa !== sb) return sa - sb
    const ia = a._preDiversityIndex ?? 0
    const ib = b._preDiversityIndex ?? 0
    if (ia !== ib) return ia - ib
    return String(a.id ?? a.externalUrl ?? "").localeCompare(String(b.id ?? b.externalUrl ?? ""))
  })
}
