/**
 * Broad-query only: reduce same-host web stacking via diversityPenalty on effective score + stable re-sort.
 * Internal rows unchanged; tie-breaks preserve pre-pass order.
 */

export function normalizeWebHostKey(rawUrl: string): string | null {
  const u = String(rawUrl || "").trim()
  if (!u) return null
  try {
    const parsed = u.startsWith("http://") || u.startsWith("https://") ? new URL(u) : new URL(`https://${u}`)
    let h = parsed.hostname.toLowerCase()
    if (h.startsWith("www.")) h = h.slice(4)
    return h || null
  } catch {
    return null
  }
}

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

/** Penalty for occurrence index n is n * K (n=0 → no penalty). */
const DIVERSITY_K = 4
const TOP_SLOTS_SOFTEN = 2
const TOP_SLOT_FACTOR = 0.25

/**
 * Returns a new array sorted by `_effectiveRankScore` (desc), stable on ties.
 * Web rows: `_diversityPenalty`, `_effectiveRankScore`, `_diversityHost`, `_hostOccurrenceIndex`, `_preDiversityIndex`.
 * Internal rows: `_effectiveRankScore === _score`, `_preDiversityIndex` only.
 */
export function applyBroadWebHostDiversity(rows: BroadDiversityRow[]): BroadDiversityRow[] {
  if (rows.length === 0) return rows

  const hostCounts = new Map<string, number>()
  const annotated = rows.map((r, preIdx) => {
    const base = { ...r, _preDiversityIndex: preIdx }
    if (r._resultKind !== "web") {
      return { ...base, _effectiveRankScore: r._score }
    }

    const url = String(r.externalUrl || r._originalUrl || r.url || "")
    const host = normalizeWebHostKey(url) ?? "(unknown)"
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
