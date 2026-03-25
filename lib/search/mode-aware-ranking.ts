/**
 * Phase 2.2 — deterministic mode-aware ranking adjustments (no LLM).
 * Applied inside scoreSearchResult; inactive → zero effect (baseline scores).
 */

import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"
import type { SearchMode } from "@/lib/search/classifyQueryIntent"

export type ModeScoreTuning = {
  textOverlapMultiplier: number
  sourceDeltaInternal: number
  sourceDeltaWeb: number
  genericWebPenaltyMultiplier: number
  scopeDelta: number
  interestDelta: number
  /** Extra penalty (subtracted) for weak-relevance generic web rows in exact mode. */
  weakGenericWebExtra: number
  /** Max boost for strong query↔row alignment in exact mode (web uses a lower cap in computePhraseTitleBoost). */
  phraseTitleBoostCap: number
}

const NEUTRAL: ModeScoreTuning = {
  textOverlapMultiplier: 1,
  sourceDeltaInternal: 0,
  sourceDeltaWeb: 0,
  genericWebPenaltyMultiplier: 1,
  scopeDelta: 0,
  interestDelta: 0,
  weakGenericWebExtra: 0,
  phraseTitleBoostCap: 0,
}

export function shouldApplySearchMode(
  mode: SearchMode | undefined,
  confidence: number | undefined,
): boolean {
  if (mode === undefined || mode === null) return false
  // Align with classifier floors (fuzzy uses ~0.4); below this, keep baseline scores.
  if (confidence !== undefined && confidence < 0.4) return false
  return true
}

export function getModeScoreTuning(mode: SearchMode): ModeScoreTuning {
  switch (mode) {
    case "exact":
      return {
        textOverlapMultiplier: 1.12,
        sourceDeltaInternal: 10,
        sourceDeltaWeb: 0,
        genericWebPenaltyMultiplier: 1.22,
        scopeDelta: 4,
        interestDelta: 4,
        weakGenericWebExtra: 18,
        phraseTitleBoostCap: 24,
      }
    case "category":
      return {
        textOverlapMultiplier: 0.98,
        sourceDeltaInternal: 8,
        sourceDeltaWeb: 4,
        genericWebPenaltyMultiplier: 1.06,
        scopeDelta: 3,
        interestDelta: 6,
        weakGenericWebExtra: 0,
        phraseTitleBoostCap: 0,
      }
    case "discovery":
      return {
        // Mild softening only — aggressive values can reorder internals when category is unset.
        textOverlapMultiplier: 0.94,
        sourceDeltaInternal: 14,
        sourceDeltaWeb: 0,
        genericWebPenaltyMultiplier: 1.1,
        scopeDelta: 2,
        interestDelta: 5,
        weakGenericWebExtra: 0,
        phraseTitleBoostCap: 0,
      }
    case "conversational":
      return {
        textOverlapMultiplier: 0.92,
        sourceDeltaInternal: 10,
        sourceDeltaWeb: 2,
        genericWebPenaltyMultiplier: 1.08,
        scopeDelta: 6,
        interestDelta: 5,
        weakGenericWebExtra: 0,
        phraseTitleBoostCap: 0,
      }
    default:
      return NEUTRAL
  }
}

function normalizeTitleMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Raw text for exact-mode phrase alignment on web rows (title alone often misses official SERP titles).
 */
export function buildWebPhraseMatchRawText(result: any): string {
  const title = String(result.title ?? "")
  const desc = String(result.description ?? "")
  const snippet = String(result._originalSnippet ?? "")
  const rawUrl = String(result.externalUrl || result._originalUrl || result.url || "")
  let pathPart = ""
  if (rawUrl.trim()) {
    try {
      const href = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl.replace(/^\/+/, "")}`
      const u = new URL(href)
      pathPart = u.pathname.replace(/\/+/g, " ").trim()
    } catch {
      pathPart = ""
    }
  }
  return [title, desc, snippet, pathPart].filter((s) => s.trim().length > 0).join(" ")
}

/**
 * Strong query↔title overlap for named-event style queries in exact mode.
 * Internal: title only. Web: title + description + snippet + URL path (same normalization / substring / token rules).
 */
export function computePhraseTitleBoost(
  intent: SearchIntent,
  result: any,
  mode: SearchMode | undefined,
  active: boolean,
  cap: number,
  kind: "internal" | "web",
): number {
  if (!active || mode !== "exact" || cap <= 0) return 0
  const capUse =
    kind === "internal" ? cap : Math.min(14, Math.round(cap * 0.52))
  if (kind === "web" && capUse <= 0) return 0
  const q = normalizeTitleMatch(intent.rawQuery || "")
  const rawText =
    kind === "web" ? buildWebPhraseMatchRawText(result) : String(result.title || "")
  const t = normalizeTitleMatch(rawText)
  if (!q || !t) return 0
  if (t.includes(q) || q.includes(t)) return capUse
  const tokens = q.split(/\s+/).filter((x) => x.length > 2)
  if (tokens.length === 0) return 0
  const hits = tokens.filter((x) => t.includes(x)).length
  if (hits === tokens.length) return capUse
  if (hits >= Math.ceil(tokens.length * 0.66)) return Math.round(capUse * 0.62)
  return 0
}

export function extraWeakGenericWebPenalty(args: {
  mode: SearchMode | undefined
  active: boolean
  kind: "internal" | "web"
  textOverlapScore: number
  baseGenericWebPenalty: number
  extraCap: number
}): number {
  const { mode, active, kind, textOverlapScore, baseGenericWebPenalty, extraCap } = args
  if (!active || mode !== "exact" || kind !== "web" || extraCap <= 0) return 0
  if (baseGenericWebPenalty >= 10 && textOverlapScore < 6) return extraCap
  return 0
}
