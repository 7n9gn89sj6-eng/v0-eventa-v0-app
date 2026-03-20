import type { SearchIntent } from "@/app/lib/search/parseSearchIntent"
import type { SearchPlan } from "@/app/lib/search/resolveSearchPlan"
import type { EventCategory } from "@prisma/client"

export type SearchScoreBreakdown = {
  sourceScore: number
  scopeScore: number
  timeScore: number
  interestScore: number
  audienceScore: number
  qualityScore: number
  mismatchPenalty: number
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
  sports: "SPORTS_OUTdoors",
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

function hasStrictTimeIntent(intent: SearchIntent, plan: SearchPlan): boolean {
  if (!intent.time?.date_from || !intent.time?.date_to) return false
  if (isBroadScope(plan)) return false
  return true
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
  return [result.title, result.description, result.venueName, result.city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function aggregatorPenalty(result: any): number {
  const title = (result.title || "").toLowerCase()
  const description = (result.description || "").toLowerCase()
  const url = String(result.externalUrl || result._originalUrl || result.url || "").toLowerCase()
  const fullText = `${title} ${description}`
  const phrases = [
    /\bwhat['']?s\s+on\b/i,
    /\bbrowse\s+events?\b/i,
    /\ball\s+(concerts?|shows?|events?)\b/i,
    /\bevent\s+(calendar|listing|guide|directory)\b/i,
  ]
  if (phrases.some((p) => p.test(fullText))) return 12
  if (
    url.includes("eventbrite.com") ||
    (url.includes("timeout.com") && fullText.includes("best"))
  ) {
    return 10
  }
  return 0
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

  let sourceScore = kind === "internal" ? 80 : 0

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
    if (ec && !citiesCompatible(targetCity, ec)) {
      return null
    }
    if (ec && citiesCompatible(targetCity, ec)) scopeScore += 32
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

  const total =
    sourceScore +
    scopeScore +
    timeScore +
    interestScore +
    audienceScore +
    qualityScore -
    mismatchPenalty +
    webListingBoost

  return {
    sourceScore,
    scopeScore,
    timeScore,
    interestScore,
    audienceScore,
    qualityScore,
    mismatchPenalty,
    webListingBoost,
    total,
  }
}

