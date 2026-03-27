/**
 * Phase 2.1 — deterministic query intent classification (rule-based, no LLM).
 * Runs after parseSearchIntent; must never throw.
 */

import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"

export type SearchIntentType =
  | "named_event"
  | "category_place"
  | "broad_browse"
  | "conversational"
  | "fuzzy"

export type SearchMode = "exact" | "category" | "discovery" | "conversational"

export type QueryIntentClassification = {
  intentType: SearchIntentType
  mode: SearchMode
  confidence: number
  reasons: string[]
}

export function mapSearchIntentTypeToMode(intentType: SearchIntentType): SearchMode {
  switch (intentType) {
    case "named_event":
      return "exact"
    case "category_place":
      return "category"
    case "broad_browse":
    case "fuzzy":
      return "discovery"
    case "conversational":
      return "conversational"
    default:
      return "discovery"
  }
}

export function normalizeQueryForClassification(query: string): string {
  return String(query || "")
    .trim()
    .replace(/\s+/g, " ")
}

export function tokenizeQuery(query: string): string[] {
  const n = normalizeQueryForClassification(query).toLowerCase()
  if (!n) return []
  return n.split(/\s+/).filter(Boolean)
}

export function isShortQuery(query: string, maxTokens = 8): boolean {
  return tokenizeQuery(query).length <= maxTokens
}

const GENERIC_SINGLETONS = new Set([
  "events",
  "event",
  "music",
  "fun",
  "stuff",
  "things",
  "something",
  "anything",
])

export function isVeryGenericQuery(query: string): boolean {
  const toks = tokenizeQuery(query)
  if (toks.length === 0) return true
  if (toks.length === 1 && GENERIC_SINGLETONS.has(toks[0]!)) return true
  return false
}

export function hasConversationalPhrase(query: string): boolean {
  const q = normalizeQueryForClassification(query).toLowerCase()
  return (
    /\bwhat'?s\s+on\b/.test(q) ||
    /\bwhat\s+is\s+on\b/.test(q) ||
    /\bwhats\s+on\b/.test(q) ||
    /\bwhat'?s\s+happening\b/.test(q) ||
    /\bwhat'?s\s+going\s+on\b/.test(q) ||
    /\bsomething\s+fun\b/.test(q) ||
    /\banything\s+happening\b/.test(q) ||
    /\bshow\s+me\b/.test(q) ||
    /\bgive\s+me\b/.test(q) ||
    /\blooking\s+for\b/.test(q) ||
    /\bplanning\b/.test(q)
  )
}

export function hasBroadBrowsePhrase(query: string): boolean {
  const q = normalizeQueryForClassification(query).toLowerCase()
  return (
    /\bthings\s+to\s+do\b/.test(q) ||
    /\bwhat\s+to\s+do\b/.test(q) ||
    /\bstuff\s+to\s+do\b/.test(q) ||
    /\bplaces\s+to\s+go\b/.test(q) ||
    /\bevents?\s+in\b/.test(q) ||
    /\bevent\s+in\b/.test(q) ||
    /\bevents?\s+(?:this|next)\s+(?:weekend|week|month)\b/i.test(q) ||
    /\bevents?\s+(?:today|tonight|tomorrow)\b/i.test(q)
  )
}

export function hasTimePhrase(query: string): boolean {
  const q = normalizeQueryForClassification(query).toLowerCase()
  return (
    /\b(tonight|today|tomorrow|this\s+weekend|next\s+weekend|next\s+week|this\s+week)\b/.test(q) ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(q) ||
    /\bthis\s+(morning|afternoon|evening|month)\b/.test(q)
  )
}

export function hasStrongCategorySignal(_query: string, parsedIntent?: SearchIntent): boolean {
  const interests = parsedIntent?.interest
  if (interests && interests.length > 0) return true
  const q = normalizeQueryForClassification(_query).toLowerCase()
  return /\b(theatre|theater|comedy|music|jazz|art|arts|food|market|markets|sport|sports|yoga|festival|exhibition|exhibitions|concert|gig)\b/.test(
    q,
  )
}

export function hasStrongPlaceSignal(_query: string, parsedIntent?: SearchIntent): boolean {
  if (parsedIntent?.placeEvidence === "explicit" && parsedIntent.place?.city?.trim()) return true
  const q = normalizeQueryForClassification(_query)
  if (/\b(in|at|near)\s+[A-Za-z][A-Za-z'\s-]{2,}\b/.test(q)) return true
  return false
}

const GREEK_OR_RARE_TAG = /\b(alpha|beta|gamma|delta|epsilon|zeta|omega|sigma)\b/i

/** All-caps token in original string (e.g. HYROX). */
export function containsBrandedAcronym(query: string): boolean {
  const q = normalizeQueryForClassification(query)
  return /\b[A-Z]{2,}\d*\b/.test(q)
}

export function containsInternationalFestivalTitle(query: string): boolean {
  const q = normalizeQueryForClassification(query).toLowerCase()
  return /\binternational\b/.test(q) && /\bfestival(s)?\b/.test(q)
}

export function containsRareOrBrandedToken(query: string): boolean {
  return (
    GREEK_OR_RARE_TAG.test(query) ||
    containsBrandedAcronym(query) ||
    containsInternationalFestivalTitle(query)
  )
}

/**
 * Multi-word title case + performance vocabulary ("gig", "show", "playing", …).
 * Covers questions like "when are These New South Whales next gig" without relying on parsed music interest.
 */
export function hasNamedArtistPerformanceFraming(raw: string): boolean {
  const trimmed = normalizeQueryForClassification(raw)
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  if (hasBroadBrowsePhrase(lower)) return false
  if (
    !/\b(?:gigs?|shows?|playing|tours?|on\s+tour|concerts?)\b/.test(lower)
  ) {
    return false
  }
  const caps = trimmed.match(/\b[A-Z][a-z]{2,}\b/g) || []
  if (caps.length < 2) return false
  const toks = tokenizeQuery(trimmed)
  if (toks.length < 4 || toks.length > 12) return false

  const whenFramed = /\bwhen\s+(?:is|are|was|do|does|did|will)\b/i.test(lower)
  const whereFramed = /\bwhere\s+(?:is|are)\b/i.test(lower)
  if (whenFramed || whereFramed) return true
  // "Foo Bar Baz tour" — likely an act name, not "live music gig" (usually <3 caps).
  if (caps.length >= 3) return true
  return false
}

/**
 * Title-like: bounded length, not dominated by browse phrasing, no leading "events in".
 */
export function hasStrongNamedEventSignal(query: string, parsedIntent?: SearchIntent): boolean {
  const raw = normalizeQueryForClassification(query)
  if (!raw) return false

  const lower = raw.toLowerCase()
  if (
    /\bnear\s+me\b/i.test(lower) &&
    !containsBrandedAcronym(raw) &&
    !containsInternationalFestivalTitle(raw) &&
    !GREEK_OR_RARE_TAG.test(raw)
  ) {
    return false
  }

  // Artist / band + gig or show framing → exact-style ranking even with parsed music interest or time words.
  if (hasNamedArtistPerformanceFraming(raw)) {
    return true
  }

  // Category + time + place (e.g. "comedy this Friday in London") is not a named title.
  if (
    hasTimePhrase(raw) &&
    !containsBrandedAcronym(raw) &&
    !containsInternationalFestivalTitle(raw) &&
    !GREEK_OR_RARE_TAG.test(raw)
  ) {
    return false
  }

  const toks = tokenizeQuery(raw)
  if (toks.length < 2 || toks.length > 12) return false

  if (hasBroadBrowsePhrase(raw) || hasConversationalPhrase(raw)) {
    if (containsBrandedAcronym(raw) || containsInternationalFestivalTitle(raw) || GREEK_OR_RARE_TAG.test(raw)) {
      // allow named override despite substring overlap
    } else {
      return false
    }
  }

  if (containsBrandedAcronym(raw)) return true
  if (containsInternationalFestivalTitle(raw)) return true
  if (GREEK_OR_RARE_TAG.test(raw)) return true
  const stop = new Set([
    "in",
    "at",
    "near",
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "for",
    "to",
    "on",
  ])
  const contentTokens = toks.filter((t) => !stop.has(t))
  if (contentTokens.length < 2) return false

  const capitalizedWords = raw.match(/\b[A-Z][a-z]{2,}\b/g) || []
  // Require 3+ tokens so "London theatre" (category + place) stays out of named_event.
  if (
    capitalizedWords.length >= 2 &&
    toks.length >= 3 &&
    toks.length <= 12 &&
    !hasBroadBrowsePhrase(lower)
  ) {
    return true
  }

  if (
    toks.length >= 3 &&
    toks.length <= 12 &&
    !hasBroadBrowsePhrase(lower) &&
    !hasConversationalPhrase(lower) &&
    (parsedIntent?.interest?.length ?? 0) === 0
  ) {
    return true
  }

  return false
}

export function classifyQueryIntent(
  query: string,
  parsedIntent?: SearchIntent,
): QueryIntentClassification {
  const reasons: string[] = []
  const q = normalizeQueryForClassification(query)

  if (!q) {
    return {
      intentType: "fuzzy",
      mode: "discovery",
      confidence: 0.2,
      reasons: ["empty query"],
    }
  }

  try {
    if (hasStrongNamedEventSignal(q, parsedIntent)) {
      if (containsBrandedAcronym(q)) reasons.push("branded or acronym token")
      if (containsInternationalFestivalTitle(q)) reasons.push("international festival title pattern")
      if (GREEK_OR_RARE_TAG.test(q)) reasons.push("distinctive token")
      if (reasons.length === 0) reasons.push("title-like phrase, no browse framing")
      return {
        intentType: "named_event",
        mode: mapSearchIntentTypeToMode("named_event"),
        confidence: 0.88,
        reasons,
      }
    }

    if (hasConversationalPhrase(q) || (hasTimePhrase(q) && /\b(in|at|near)\b/i.test(q))) {
      reasons.push("conversational or time+place framing")
      return {
        intentType: "conversational",
        mode: mapSearchIntentTypeToMode("conversational"),
        confidence: 0.82,
        reasons,
      }
    }

    if (hasBroadBrowsePhrase(q)) {
      reasons.push("broad browse phrase")
      return {
        intentType: "broad_browse",
        mode: mapSearchIntentTypeToMode("broad_browse"),
        confidence: 0.85,
        reasons,
      }
    }

    if (hasStrongCategorySignal(q, parsedIntent) && hasStrongPlaceSignal(q, parsedIntent)) {
      reasons.push("category signal with place")
      return {
        intentType: "category_place",
        mode: mapSearchIntentTypeToMode("category_place"),
        confidence: 0.8,
        reasons,
      }
    }

    if (
      /\bnear\s+me\b/i.test(q) ||
      (hasStrongCategorySignal(q, parsedIntent) && !hasStrongPlaceSignal(q, parsedIntent) && hasTimePhrase(q))
    ) {
      reasons.push("underspecified place or time-only activity")
      return {
        intentType: "fuzzy",
        mode: mapSearchIntentTypeToMode("fuzzy"),
        confidence: 0.45,
        reasons,
      }
    }

    reasons.push("default fuzzy")
    return {
      intentType: "fuzzy",
      mode: mapSearchIntentTypeToMode("fuzzy"),
      confidence: 0.4,
      reasons,
    }
  } catch {
    return {
      intentType: "fuzzy",
      mode: "discovery",
      confidence: 0.25,
      reasons: ["classifier fallback"],
    }
  }
}

export function classifyQueryIntentSafe(
  query: string,
  parsedIntent?: SearchIntent,
): QueryIntentClassification {
  try {
    return classifyQueryIntent(query, parsedIntent)
  } catch {
    return {
      intentType: "fuzzy",
      mode: "discovery",
      confidence: 0.25,
      reasons: ["classifier safe fallback"],
    }
  }
}
