import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"
import type { SearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { scoreContextAgainstTextBlob } from "@/lib/search/search-intent-context"
import type { EventCategory } from "@prisma/client"

export type SearchScoreBreakdown = {
  /** Internal rows receive a large deterministic boost so strong internal beats strong web. */
  sourceScore: number
  /** Overlap of meaningful query tokens with title/description/city. */
  textOverlapScore: number
  /** Minor boost for near-future events. */
  freshnessScore: number
  scopeScore: number
  timeScore: number
  interestScore: number
  audienceScore: number
  contextScore: number
  qualityScore: number
  mismatchPenalty: number
  /** Web-only: generic city calendars / what's-on landing pages. */
  genericWebPenalty: number
  /** Optional extra boost applied to web rows in the route (URLs/snippets). */
  webListingBoost: number
  total: number
}

export type SearchResultKind = "internal" | "web"

const CATEGORY_KEY_TO_ENUM: Record<string, EventCategory> = {
  music: "MUSIC_NIGHTLIFE",
  markets: "MARKETS_FAIRS",
  arts: "ARTS_CULTURE",
  food: "FOOD_DRINK",
  sports: "SPORTS_OUTDOORS",
  family: "FAMILY_KIDS",
  community: "COMMUNITY_CAUSES",
  learning: "LEARNING_TALKS",
}

function citiesCompatible(target: string, eventCity: string): boolean {
  const t = target.toLowerCase().trim()
  const e = eventCity.toLowerCase().trim()
  if (!t || !e) return true
  return e.includes(t) || t.includes(e)
}

function countryMatchesTarget(target: string, eventCountry: string): boolean {
  const t = target.toLowerCase().trim()
  const e = eventCountry.toLowerCase().trim()
  if (!t || !e) return true
  return e.includes(t) || t.includes(e)
}

function countryInRegionList(eventCountry: string, list: string[]): boolean {
  const e = eventCountry.toLowerCase().trim()
  if (!e) return false
  return list.some((x) => {
    const c = x.toLowerCase()
    return e.includes(c) || c.includes(e)
  })
}

function parseEventBounds(result: any, now: Date): { start: Date; end: Date } | null {
  try {
    const start = result.startAt ? new Date(result.startAt) : null
    if (!start || isNaN(start.getTime())) return null
    const endRaw = result.endAt ? new Date(result.endAt) : null
    const end = endRaw && !isNaN(endRaw.getTime()) ? endRaw : start
    return { start, end }
  } catch {
    return null
  }
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aEnd.getTime() >= bStart.getTime() && aStart.getTime() <= bEnd.getTime()
}

function isBroadScope(plan: SearchPlan): boolean {
  return plan.scope === "broad"
}

function hasStrictTimeIntent(_intent: SearchIntent, plan: SearchPlan): boolean {
  return plan.filters.strictTimeOverlap
}

function primaryInterestKey(intent: SearchIntent, rankingCategory?: string): string | undefined {
  return rankingCategory?.toLowerCase() || intent.interest?.[0]?.toLowerCase()
}

function structuredCategoryMatch(catKey: string | undefined, result: any): boolean {
  if (!catKey) return false
  const enumVal = CATEGORY_KEY_TO_ENUM[catKey]
  const eventCategoryUpper = result.category ? String(result.category).toUpperCase() : ""
  if (enumVal && eventCategoryUpper === enumVal) return true
  const cats = Array.isArray(result.categories) ? result.categories.map((c: string) => String(c).toLowerCase()) : []
  return cats.some((c) => c.includes(catKey) || (enumVal && String(c).toUpperCase() === enumVal))
}

function textBlob(result: any): string {
  return [result.title, result.description, result.venueName, result.city, result.location?.city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

const TEXT_OVERLAP_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "our",
  "are",
  "was",
  "has",
  "have",
  "will",
  "near",
  "around",
  "into",
  "about",
  "event",
  "events",
])

/**
 * Deterministic query↔row text overlap (no AI).
 */
export function queryTextOverlapScore(intent: SearchIntent, result: any): number {
  const raw = (intent.rawQuery || "").trim().toLowerCase()
  if (!raw) return 0
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9'-]/gi, ""))
    .filter((t) => t.length > 2 && !TEXT_OVERLAP_STOPWORDS.has(t))
  if (tokens.length === 0) return 0
  const blob = textBlob(result)
  let hits = 0
  for (const t of tokens) {
    if (blob.includes(t)) hits += 1
  }
  return Math.min(14, hits * 2)
}

function computeFreshnessScore(result: any, now: Date): number {
  const bounds = parseEventBounds(result, now)
  if (!bounds) return 0
  if (bounds.end.getTime() < now.getTime()) return 0
  const days = (bounds.start.getTime() - now.getTime()) / (86400 * 1000)
  if (days >= 0 && days <= 14) return 3
  if (days <= 45) return 1
  return 0
}

/**
 * Penalise generic web listing / hub pages so specific rows (including internal) outrank them.
 */
export function genericWebListingPenalty(result: any): number {
  const url = String(result.externalUrl || result._originalUrl || result.url || "").toLowerCase()
  const title = String(result.title || "").toLowerCase()
  const desc = String(result.description || "").toLowerCase()
  const blob = `${url} ${title} ${desc}`
  let p = 0
  if (/\bwhat['']?s\s+on\b/i.test(title) || /\bwhat['']?s\s+on\b/i.test(desc)) p += 16
  if (/\bbrowse\s+all\s+events?\b/i.test(blob) || /\ball\s+upcoming\s+events?\b/i.test(blob)) p += 14
  if (/\/whats-?on\b|\/whatson\b|\/things-to-do\b/i.test(url)) p += 18
  if (/\/events?\/?$/i.test(url) && url.split("/").filter(Boolean).length <= 4) p += 10
  if (/\bevent\s+(calendar|guide|directory|listing)s?\b/i.test(blob)) p += 12
  return Math.min(45, p)
}

function aggregatorPenalty(result: any): number {
  const title = (result.title || "").toLowerCase()
  const description = (result.description || "").toLowerCase()
  const url = String(result.externalUrl || result._originalUrl || result.url || "").toLowerCase()
  const fullText = `${title} ${description}`
  const phrases = [
    /\bbrowse\s+events?\b/i,
    /\ball\s+(concerts?|shows?|events?)\b/i,
  ]
  let p = 0
  if (phrases.some((re) => re.test(fullText))) p += 10
  if (
    url.includes("eventbrite.com") ||
    (url.includes("timeout.com") && fullText.includes("best"))
  ) {
    p += 12
  }
  return Math.min(22, p)
}

/**
 * Deterministic relevance score. Returns null when the row should be dropped after execution (hard mismatch).
 */
export function scoreSearchResult(args: {
  result: any
  intent: SearchIntent
  searchPlan: SearchPlan
  now: Date
  kind: SearchResultKind
  rankingCategory?: string
  /** Merged URL/snippet boost from the route (web only). */
  webListingBoost?: number
}): SearchScoreBreakdown | null {
  const { result, intent, searchPlan, now, kind, rankingCategory, webListingBoost = 0 } = args
  const plan = searchPlan
  const restrict = plan.filters.applyLocationRestriction

  let sourceScore = kind === "internal" ? 115 : 0
  const textOverlapScore = queryTextOverlapScore(intent, result)
  const freshnessScore = computeFreshnessScore(result, now)

  let scopeScore = 0
  const targetCity = plan.location.city?.trim()
  const targetCountry = plan.location.country?.trim()
  const regionCountries = plan.location.countries
  const targetRegionLabel = plan.location.region?.trim()

  if (!restrict || plan.scope === "global") {
    scopeScore += 8
  } else if (plan.scope === "region" && regionCountries && regionCountries.length > 0) {
    const ec = String(result.country || result.location?.country || "").trim()
    if (ec && countryInRegionList(ec, regionCountries)) {
      scopeScore += 35
      if (targetRegionLabel) {
        const blob = textBlob(result)
        if (blob.includes(targetRegionLabel.toLowerCase())) scopeScore += 6
      }
    } else if (ec) {
      return null
    } else {
      scopeScore += 4
    }
  } else if (targetCity) {
    const ec = String(result.city || result.location?.city || "").trim()
    const ep = String(result.parentCity || "").trim()
    const strongCityMatch = Boolean(ec && citiesCompatible(targetCity, ec))
    const strongParentMatch = Boolean(ep && citiesCompatible(targetCity, ep))
    if (ec && !strongCityMatch && !strongParentMatch) {
      return null
    }
    if (strongCityMatch || strongParentMatch) scopeScore += 32
    else scopeScore += 6
    if (targetCountry) {
      const cty = String(result.country || result.location?.country || "").trim()
      if (cty && countryMatchesTarget(targetCountry, cty)) scopeScore += 14
    }
  } else if (targetCountry) {
    const cty = String(result.country || result.location?.country || "").trim()
    if (cty && countryMatchesTarget(targetCountry, cty)) scopeScore += 22
    else if (cty) scopeScore -= 8
    else scopeScore += 4
  } else {
    scopeScore += 6
  }

  let timeScore = 0
  const bounds = parseEventBounds(result, now)
  const strictTime = hasStrictTimeIntent(intent, plan)
  if (bounds) {
    if (strictTime) {
      const wStart = new Date(intent.time!.date_from!)
      const wEnd = new Date(intent.time!.date_to!)
      if (!rangesOverlap(bounds.start, bounds.end, wStart, wEnd)) {
        return null
      }
      timeScore += 28
    } else {
      if (bounds.end.getTime() >= now.getTime()) {
        const days = (bounds.start.getTime() - now.getTime()) / (86400 * 1000)
        if (days >= 0 && days <= 7) timeScore += 18
        else if (days <= 30) timeScore += 12
        else timeScore += 6
      } else {
        timeScore -= 4
      }
    }
  } else {
    timeScore += isBroadScope(plan) ? 2 : -2
  }

  const catKey = primaryInterestKey(intent, rankingCategory)
  let interestScore = 0
  let mismatchPenalty = 0

  const broad = isBroadScope(plan)
  const strictCat = plan.filters.strictCategory

  if (catKey) {
    if (structuredCategoryMatch(catKey, result)) {
      interestScore += broad ? 18 : 26
      const blob = textBlob(result)
      if (catKey === "music" && /\blive\s+music\b/i.test(blob)) {
        interestScore += 8
      }
    } else {
      const blob = textBlob(result)
      if (blob.includes(catKey)) {
        interestScore += broad ? 10 : 16
      } else {
        const synonymMap: Record<string, string[]> = {
          music: ["gig", "concert", "dj", "live"],
          food: ["eat", "dining", "restaurant", "market"],
          arts: ["gallery", "exhibition", "museum"],
          markets: ["market", "fair", "bazaar"],
          family: ["kids", "children"],
          sports: ["fitness", "yoga", "run", "outdoor", "trail"],
        }
        const syns = synonymMap[catKey] || []
        if (syns.some((s) => blob.includes(s))) interestScore += broad ? 6 : 10
        else if (strictCat && !broad) mismatchPenalty += 14
        else mismatchPenalty += 5
      }
    }

    if (strictCat && !broad && catKey === "food") {
      const blob = textBlob(result)
      if (/\bmusic\b|\bgig\b|\bconcert\b/i.test(blob) && !blob.includes("food")) mismatchPenalty += 8
    }
    if (strictCat && !broad && catKey === "music") {
      const blob = textBlob(result)
      if (/\bfood pop|restaurant\b/i.test(blob) && !/\bmusic\b|\bgig\b/i.test(blob)) mismatchPenalty += 8
    }
  } else {
    interestScore += broad ? 8 : 3
  }

  let audienceScore = 0
  const wantsFamily = intent.audience?.some((a) => /family|kids/i.test(a))
  if (wantsFamily) {
    const blob = textBlob(result)
    if (/\b(kids|children|family)\b/i.test(blob)) audienceScore += 10
  }

  const wantsFree = intent.price?.some((p) => /free|cheap/i.test(p))
  if (wantsFree) {
    if (result.priceFree === true) audienceScore += 8
    else if (/\bfree\b|\bcheap\b/i.test(textBlob(result))) audienceScore += 5
  }

  const blobLower = textBlob(result)
  const contextScore = scoreContextAgainstTextBlob(intent.context, blobLower)

  if (
    intent.context?.includes("farmers_market") &&
    strictCat &&
    !broad &&
    /\bmarkets?\b/.test(blobLower) &&
    !/\b(farmers?|farm\s+market|producer|growers?|organic)\b/.test(blobLower)
  ) {
    mismatchPenalty += 5
  }

  let qualityScore = 0
  const title = String(result.title || "")
  const desc = String(result.description || "")
  if (title.length >= 12) qualityScore += 6
  if (desc.length >= 40) qualityScore += 6
  if (result.venueName || result.address) qualityScore += 5
  if (bounds && bounds.end.getTime() >= now.getTime()) qualityScore += 4

  if (kind === "web") {
    mismatchPenalty += aggregatorPenalty(result)
  }

  const genericWebPenalty = kind === "web" ? genericWebListingPenalty(result) : 0

  const total =
    sourceScore +
    textOverlapScore +
    freshnessScore +
    scopeScore +
    timeScore +
    interestScore +
    audienceScore +
    contextScore +
    qualityScore -
    mismatchPenalty -
    genericWebPenalty +
    webListingBoost

  return {
    sourceScore,
    textOverlapScore,
    freshnessScore,
    scopeScore,
    timeScore,
    interestScore,
    audienceScore,
    contextScore,
    qualityScore,
    mismatchPenalty,
    genericWebPenalty,
    webListingBoost,
    total,
  }
}

