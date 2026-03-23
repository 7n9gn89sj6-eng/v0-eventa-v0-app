/**
 * Broad-query only: reduce same-host web stacking by effective score + stable re-sort.
 * Internal rows are unchanged; relative order preserved on ties via pre-pass index.
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

const PENALTY_SECOND = 6
const PENALTY_THIRD_BASE = 14
const PENALTY_EXTRA_PER = 4
const PENALTY_CAP = 34
const TOP_SLOTS_SOFTEN = 2
const TOP_SLOT_FACTOR = 0.25

/**
 * Returns a new array sorted by `_effectiveRankScore` (desc), stable on ties.
 * Sets on web rows: `_effectiveRankScore`, `_diversityHost`, `_hostOccurrenceIndex`, `_preDiversityIndex`.
 * Internal rows: `_effectiveRankScore === _score`, same index field.
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

    let penalty = 0
    if (occurrenceIndex === 1) {
      penalty = PENALTY_SECOND
    } else if (occurrenceIndex >= 2) {
      penalty = Math.min(
        PENALTY_CAP,
        PENALTY_THIRD_BASE + (occurrenceIndex - 2) * PENALTY_EXTRA_PER,
      )
    }

    if (preIdx < TOP_SLOTS_SOFTEN) {
      penalty = Math.floor(penalty * TOP_SLOT_FACTOR)
    }

    const effective = r._score - penalty
    return {
      ...base,
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
