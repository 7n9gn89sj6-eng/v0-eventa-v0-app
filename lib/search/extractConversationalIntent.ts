/**
 * Phase 2.3 — deterministic conversational hints (additive; no LLM).
 * Does not replace parseSearchIntent or resolveSearchPlan.
 */

import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"
import type { SearchIntentType, SearchMode } from "@/lib/search/classifyQueryIntent"

export type ConversationalExtraction = {
  /** Non-destructive support string for overlap/scoring only. */
  rewrittenQuery?: string
  inferredCategory?: string | null
  inferredBrowseIntent?: boolean
  inferredTimeText?: string | null
  inferredPlaceText?: string | null
  confidence: number
  reasons: string[]
}

const PLACE_STOP = new Set([
  "me",
  "you",
  "the",
  "a",
  "an",
  "here",
  "there",
  "town",
  "city",
  "tonight",
  "tomorrow",
  "today",
  "weekend",
  "week",
])

function detectBrowseFraming(q: string): boolean {
  const s = q.toLowerCase()
  return (
    /\bwhat'?s\s+on\b/.test(s) ||
    /\bwhat\s+is\s+on\b/.test(s) ||
    /\banything\s+happening\b/.test(s) ||
    /\bsomething\s+fun\b/.test(s) ||
    /\bfun\s+things\b/.test(s) ||
    /\bthings\s+to\s+do\b/.test(s) ||
    /\bwhat'?s\s+happening\b/.test(s) ||
    /\bwhat'?s\s+going\s+on\b/.test(s)
  )
}

function detectTimeText(q: string): string | null {
  const s = q.toLowerCase()
  const mWeekend = s.match(/\b(this|next)\s+weekend\b/)
  if (mWeekend) return `${mWeekend[1]} weekend`
  const mWeek = s.match(/\b(this|next)\s+week\b/)
  if (mWeek) return `${mWeek[1]} week`
  const mDay = s.match(
    /\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )
  if (mDay) return `${mDay[1]} ${mDay[2]}`
  if (/\btonight\b/.test(s)) return "tonight"
  if (/\btomorrow\b/.test(s)) return "tomorrow"
  if (/\btoday\b/.test(s)) return "today"
  return null
}

function detectCategory(q: string): string | null {
  const s = q.toLowerCase()
  if (/\bsomething\s+fun\b/.test(s)) return "entertainment"
  if (/\bcomedy\b|\bstand[-\s]?up\b/.test(s)) return "comedy"
  if (/\bmusic\b|\bgig\b|\bconcert\b/.test(s)) return "music"
  if (/\btheatre\b|\btheater\b/.test(s)) return "theatre"
  if (/\barts\b/.test(s) || /\bart\b/.test(s)) return "art"
  if (/\bfamily\b|\bkids\b|\bchildren\b/.test(s)) return "family"
  if (/\bmarkets?\b/.test(s)) return "markets"
  if (/\bfood\b|\beat\b|\bdining\b|\brestaurant\b/.test(s)) return "food"
  if (/\bnightlife\b|\bclubs?\b/.test(s)) return "nightlife"
  if (/\bfun\s+things\b/.test(s)) return "entertainment"
  if (/\bfun\b/.test(s) && detectBrowseFraming(q)) return "entertainment"
  return null
}

/** `in X` / `around X` where X looks like a place name (not "me"). */
function detectWeakPlace(q: string, parsed?: SearchIntent): string | null {
  if (parsed?.placeEvidence === "explicit" && parsed.place?.city?.trim()) {
    return parsed.place.city.trim()
  }
  const re = /\b(?:in|around)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})\b/g
  let best: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(q)) !== null) {
    const raw = m[1]!.trim()
    const head = raw.split(/\s+/)[0]!.toLowerCase()
    if (PLACE_STOP.has(head)) continue
    if (raw.length < 3) continue
    best = raw
  }
  if (/\bnear\s+me\b/i.test(q)) {
    return best ? `${best} near me` : "near me"
  }
  return best
}

/** category_place: only when time or browse cues add harmless structure beyond category+place. */
export function shouldRunConversationalExtraction(
  mode?: SearchMode,
  intentType?: SearchIntentType,
  rawQuery?: string,
): boolean {
  if (intentType === "named_event") return false
  if (intentType === "category_place") {
    const q = String(rawQuery || "")
    if (!q.trim()) return false
    return Boolean(detectTimeText(q) || detectBrowseFraming(q))
  }
  return mode === "conversational" || mode === "fuzzy" || mode === "discovery"
}

export function buildConversationalOverlapSupplement(e: ConversationalExtraction): string {
  const parts: string[] = []
  if (e.inferredCategory) parts.push(e.inferredCategory)
  if (e.inferredTimeText) parts.push(e.inferredTimeText)
  if (e.inferredPlaceText) parts.push(e.inferredPlaceText)
  if (e.inferredBrowseIntent) parts.push("events happenings")
  return parts.join(" ").trim()
}

export function extractConversationalIntent(input: {
  rawQuery: string
  parsedIntent?: SearchIntent
  queryIntentType?: SearchIntentType
  searchMode?: SearchMode
}): ConversationalExtraction | null {
  try {
    const q = String(input.rawQuery || "").trim()
    if (!q) return null
    if (!shouldRunConversationalExtraction(input.searchMode, input.queryIntentType, q)) return null

    const reasons: string[] = []
    let inferredBrowseIntent = false
    if (detectBrowseFraming(q)) {
      inferredBrowseIntent = true
      reasons.push("browse framing")
    }

    const inferredTimeText = detectTimeText(q)
    if (inferredTimeText) reasons.push(`time:${inferredTimeText}`)

    let inferredCategory = detectCategory(q)
    if (inferredCategory) reasons.push(`category:${inferredCategory}`)

    let inferredPlaceText = detectWeakPlace(q, input.parsedIntent)
    if (inferredPlaceText) reasons.push(`place:${inferredPlaceText}`)

    if (reasons.length === 0) return null

    const confidence = Math.min(0.88, 0.52 + reasons.length * 0.08)
    const rewrittenQuery = [inferredPlaceText, inferredTimeText, inferredCategory, inferredBrowseIntent ? "browse" : ""]
      .filter(Boolean)
      .join(" · ")

    return {
      rewrittenQuery: rewrittenQuery || undefined,
      inferredCategory: inferredCategory ?? null,
      inferredBrowseIntent: inferredBrowseIntent || undefined,
      inferredTimeText: inferredTimeText ?? null,
      inferredPlaceText: inferredPlaceText ?? null,
      confidence,
      reasons,
    }
  } catch {
    return null
  }
}
