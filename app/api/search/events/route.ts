import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"
import type { EventCategory } from "@prisma/client"
import { searchWeb } from "@/lib/search/web-search"
import { withLanguageColumnGuard, getEventSelectWithoutLanguage, isLanguageFilteringAvailable } from "@/lib/db-runtime-guard"
import { buildDateOverlapWhere, buildDateRangeOverlapWhere } from "@/lib/search/date-overlap"
import { isEventIntentQuery } from "@/lib/search/event-ranking"
import { applyBroadWebHostDiversity } from "@/lib/search/broad-web-host-diversity"
import { scoreSearchResult } from "@/lib/search/score-search-result"
import { getExpandedTermGroups } from "@/lib/search/search-taxonomy"
import { normalizeSearchUtterance, stripTextSearchStopwords } from "@/lib/search/normalize-search-utterance"
import {
  buildPlaceResolveInput,
  isResolvedPlaceCompatibleWithParsed,
  resolvePlace,
  shouldAttemptPlaceResolve,
} from "@/lib/search/resolve-place"
import { interpretSearchIntent, type InterpretedSearchIntent } from "@/lib/search/ai-intent"
import { buildPhase1Interpretation } from "@/lib/search/phase1-interpretation"
import {
  parseSearchIntent,
  rankingCategoryFromParsedIntent,
  type SearchIntent,
} from "@/app/lib/search/parseSearchIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { EXECUTION_CITY_VARIATIONS } from "@/lib/search/city-variations"
import { fetchParentMetroFromStoredEvents } from "@/lib/search/ambient-parent-metro"
import {
  applyStrictInternalCityFilter,
  buildStructuredCityLocationOrClause,
  replaceExecutionCityInWhere,
} from "@/lib/search/search-location-clause"
import { microLocationForWebSearch } from "@/lib/search/micro-location-for-web"
import { topicQueryForCityLevelWeb } from "@/lib/search/topic-query-for-city-level-web"

/**
 * Helper function to check if text contains Australian location indicators
 * @param text - Text to check
 * @returns true if text contains Australian indicators
 */
function hasAustraliaIndicators(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return /\b(australia|australian|au|melbourne|sydney|brisbane|perth|adelaide|canberra|darwin|vic|victoria|naarm|tasmania|queensland|nsw|new south wales|western australia|wa|south australia|sa|northern territory|nt|australian capital territory|act)\b/i.test(lower)
}

/** Structured OR filter: event.country matches any resolved region member. */
function applyRegionCountriesWhere(where: any, countries: string[]) {
  if (!countries.length) return
  where.AND = where.AND || []
  where.AND.push({
    OR: countries.map((c) => ({ country: { contains: c, mode: "insensitive" as const } })),
  })
}

/** Max internal rows (after strict city filter) before broadening a UI-selected suburb to its parent metro. */
const AMBIENT_SUBURB_INTERNAL_THRESHOLD = 2

/** Secondary fallback when no published event supplies `parentCity` for this locality (ambient UI only). */
const AMBIENT_SUBURB_PARENT_CITY: Record<string, string> = {
  brunswick: "Melbourne",
}

function ambientSuburbParentExpansionEligible(opts: {
  q: string
  executionCity: string | null
  internalCountAfterStrict: number
  effectiveLocationSource: "query" | "ui" | "device"
  scope: SearchIntent["scope"]
  parsedIntent: SearchIntent
}): boolean {
  if (!opts.q.trim() || !opts.executionCity) return false
  if (opts.internalCountAfterStrict > AMBIENT_SUBURB_INTERNAL_THRESHOLD) return false
  if (opts.effectiveLocationSource !== "ui") return false
  if (opts.scope !== "local" && opts.scope !== "broad") return false
  if (opts.parsedIntent.placeEvidence === "explicit" && opts.parsedIntent.place?.city) return false
  return true
}

const EXTERNAL_STUB_EVENTS = [
  {
    id: "ext-1",
    title: "Summer Music Festival",
    description: "Annual outdoor music festival featuring local and international artists",
    startAt: new Date("2025-07-15T18:00:00Z"),
    endAt: new Date("2025-07-15T23:00:00Z"),
    location: {
      address: "Central Park",
      city: "New York",
      country: "USA",
    },
    imageUrl: "/vibrant-music-festival.png",
    externalUrl: "https://example.com/summer-fest",
    source: "web",
  },
  {
    id: "ext-2",
    title: "Tech Conference 2025",
    description: "Leading technology conference with workshops and networking",
    startAt: new Date("2025-08-20T09:00:00Z"),
    endAt: new Date("2025-08-22T17:00:00Z"),
    location: {
      address: "Convention Center",
      city: "San Francisco",
      country: "USA",
    },
    imageUrl: "/tech-conference.png",
    externalUrl: "https://example.com/tech-conf",
    source: "web",
  },
]

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  let q = (url.searchParams.get("query") || url.searchParams.get("q") || "").trim()
  q = normalizeSearchUtterance(q)
  const take = Math.min(Number.parseInt(url.searchParams.get("take") || "20", 10) || 20, 50)
  const page = Math.max(Number.parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
  const skip = (page - 1) * take
  let city = url.searchParams.get("city")
  let country = url.searchParams.get("country")
  let category = url.searchParams.get("category")
  let dateFrom = url.searchParams.get("date_from")
  let dateTo = url.searchParams.get("date_to")
  const debug = url.searchParams.get("debug") === "1"
  const searchRequestStartedAt = Date.now()

  // Define 'now' once at the top level for reuse throughout the function
  const now = new Date()
  let ambientParentExpansionApplied = false

  // Detect if this is an event-intent query
  const isEventQuery = isEventIntentQuery(q)

  // Intent -> Plan resolution (deterministic, query-first precedence).
  let parsedIntent: SearchIntent = q ? parseSearchIntent(q) : parseSearchIntent("")

  // When place is only implicit, structured URL city/country wins over a conflicting weak parse.
  // Explicit query geography (e.g. "live music Melbourne" with city=Sydney) must stay query-first — see resolveSearchPlan.
  const urlCityTrim = (city ?? "").trim()
  const urlCountryTrim = (country ?? "").trim()
  if ((urlCityTrim || urlCountryTrim) && parsedIntent.placeEvidence !== "explicit") {
    const p = parsedIntent.place
    const pc = p?.city?.trim().toLowerCase() ?? ""
    const pco = p?.country?.trim().toLowerCase() ?? ""
    const uc = urlCityTrim.toLowerCase()
    const uco = urlCountryTrim.toLowerCase()
    const cityConflicts = Boolean(uc && pc && pc !== uc)
    const countryConflicts = Boolean(uco && pco && pco !== uco)
    if (cityConflicts || countryConflicts) {
      parsedIntent = {
        ...parsedIntent,
        place: undefined,
        placeEvidence: "none",
      }
    }
  }

  let intentForPlan: SearchIntent = parsedIntent
  const explicitParsedCountry = parsedIntent.place?.country?.trim()
  const countryBiasFromContext: string | null = explicitParsedCountry
    ? null
    : (country ?? "").trim() || process.env.NEXT_PUBLIC_DEFAULT_SEARCH_COUNTRY?.trim() || null
  const placeResolveInput = parsedIntent.place
    ? buildPlaceResolveInput(parsedIntent.place, countryBiasFromContext)
    : null
  if (shouldAttemptPlaceResolve(parsedIntent, placeResolveInput) && placeResolveInput) {
    console.log(
      "[v0] place.resolve",
      JSON.stringify({
        localityFromParser: parsedIntent.place?.raw?.trim() || parsedIntent.place?.city || null,
        explicitParsedCountry: explicitParsedCountry || null,
        biasCountry: countryBiasFromContext || null,
        geocodeInput: placeResolveInput,
      }),
    )
    try {
      const resolved = await resolvePlace(placeResolveInput)
      if (resolved && isResolvedPlaceCompatibleWithParsed(parsedIntent.place!, resolved)) {
        console.log(
          "[v0] place.resolve merged",
          JSON.stringify({
            geocodeInput: placeResolveInput,
            resolved: {
              city: resolved.city,
              country: resolved.country,
              region: resolved.region,
              parentCity: resolved.parentCity,
            },
          }),
        )
        const prevCountry = parsedIntent.place?.country?.trim()
        intentForPlan = {
          ...parsedIntent,
          place: {
            ...parsedIntent.place!,
            city: resolved.city,
            country: prevCountry || resolved.country,
            region: resolved.region ?? parsedIntent.place?.region,
          },
        }
      }
    } catch {
      // Fallback: keep parsedIntent unchanged
    }
  }

  const searchPlan = resolveSearchPlan(intentForPlan, { city: city ?? undefined, country: country ?? undefined })
  const shouldStrictCategoryFilter = searchPlan.filters.strictCategory

  let lastInterpreted: InterpretedSearchIntent | null = null
  let lastInterpretError = false

  if (q.trim().length > 0) {
    try {
      lastInterpreted = await interpretSearchIntent(q, {
        city: searchPlan.location.city ?? undefined,
        country: searchPlan.location.country ?? undefined,
      })
    } catch (err) {
      lastInterpretError = true
      console.warn("[v0] Intent interpretation failed; continuing with deterministic plan.", err)
    }
  }

  if (q) {
    const missingCategory = !category || category.trim().length === 0 || category === "all"
    const missingDate = !dateFrom || !dateTo

    if (missingCategory && parsedIntent.interest?.length) {
      category = parsedIntent.interest[0]
    }

    if (missingDate) {
      if (parsedIntent.time?.date_from) dateFrom = parsedIntent.time.date_from
      if (parsedIntent.time?.date_to) dateTo = parsedIntent.time.date_to
    }

    // Keep optional additive interpreter as low-priority augmentation (single interpretSearchIntent result).
    if (missingCategory || missingDate) {
      const threshold = 0.6
      const interpreted = lastInterpreted
      if (interpreted) {
        if (missingCategory && !category && interpreted.category && (interpreted.confidence ?? 0) >= threshold) {
          category = interpreted.category
        }

        if (
          missingDate &&
          !dateFrom &&
          !dateTo &&
          interpreted.date_from &&
          interpreted.date_to &&
          (interpreted.confidence ?? 0) >= threshold
        ) {
          dateFrom = interpreted.date_from
          dateTo = interpreted.date_to
        }
      }
    }
  }

  // Execution location comes only from the resolved search plan (never raw URL after this point).
  city = searchPlan.filters.applyLocationRestriction ? (searchPlan.location.city ?? null) : null
  country = searchPlan.filters.applyLocationRestriction ? (searchPlan.location.country ?? null) : null
  console.log("[v0] place.resolve final city used:", city ?? "(none)")

  const regionCountriesForFilter: string[] | null =
    searchPlan.filters.applyLocationRestriction &&
    searchPlan.scope === "region" &&
    Array.isArray(searchPlan.location.countries) &&
    searchPlan.location.countries.length > 0
      ? searchPlan.location.countries
      : null

  const effectiveLocation: {
    city: string | null
    country: string | null
    region: string | null
    countries: string[] | null
    scope: (typeof searchPlan)["scope"]
    source: "query" | "ui" | "device"
  } = {
    city,
    country,
    region: searchPlan.filters.applyLocationRestriction ? (searchPlan.location.region ?? null) : null,
    countries: regionCountriesForFilter,
    scope: searchPlan.scope,
    source:
      searchPlan.location.source === "query"
        ? "query"
        : searchPlan.location.source === "selected"
          ? "ui"
          : "device",
  }

  let effectiveCity = city
  const effectiveCountry = country
  const microLocation: string | null = microLocationForWebSearch(parsedIntent)

  const emitSearchEventsComplete = (opts: {
    internalCount: number
    externalCount: number
    totalReturned: number
    includesWeb: boolean
    webCalled: boolean
    emptyState: boolean
    isEventIntent: boolean
  }) => {
    console.log(
      JSON.stringify({
        event: "search.events.complete",
        query: q,
        scope: effectiveLocation.scope,
        effectiveLocation: {
          city: effectiveLocation.city,
          country: effectiveLocation.country,
          region: effectiveLocation.region,
          source: effectiveLocation.source,
          scope: effectiveLocation.scope,
        },
        internalCount: opts.internalCount,
        externalCount: opts.externalCount,
        totalReturned: opts.totalReturned,
        includesWeb: opts.includesWeb,
        webCalled: opts.webCalled,
        emptyState: opts.emptyState,
        isEventIntent: opts.isEventIntent,
        durationMs: Date.now() - searchRequestStartedAt,
      }),
    )
  }

  const emitSearchEventsError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.log(
      JSON.stringify({
        event: "search.events.error",
        query: q,
        scope: effectiveLocation.scope,
        effectiveLocation: {
          city: effectiveLocation.city,
          country: effectiveLocation.country,
          region: effectiveLocation.region,
          source: effectiveLocation.source,
          scope: effectiveLocation.scope,
        },
        durationMs: Date.now() - searchRequestStartedAt,
        error: message,
      }),
    )
  }

  const hasWebGeoContext =
    Boolean(effectiveCity || effectiveCountry) ||
    (searchPlan.scope === "region" &&
      Boolean(
        searchPlan.location.region ||
          (searchPlan.location.countries && searchPlan.location.countries.length > 0),
      )) ||
    searchPlan.scope === "global"

  console.log("[v0] Final location used:", {
    city,
    country,
    source: effectiveLocation.source,
  })

  // NOTE: Location should come from URL params (city/country) set by UI location picker
  // Only extract from query as fallback if location params are not provided
  // This ensures web search uses the UI location control, not query extraction
  // If the user explicitly set a destination city in the query, never reintroduce URL/UI location later.
  if (
    q &&
    isEventQuery &&
    effectiveLocation.source !== "query" &&
    !city &&
    !country &&
    searchPlan.scope !== "region"
  ) {
    try {
      const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/search/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (intentResponse.ok) {
        const intentData = await intentResponse.json()
        const extracted = intentData.extracted || {}
        if (extracted.city && !city) {
          city = extracted.city.trim()
          console.log(`[v0] 🔍 Extracted city from query (fallback): "${city}"`)
        }
        if (extracted.country && !country) {
          country = extracted.country.trim()
          console.log(`[v0] 🔍 Extracted country from query (fallback): "${country}"`)
        }
      }
    } catch (error) {
      console.warn(`[v0] Failed to extract entities from query:`, error)
      // Continue without extraction - not critical
    }
  }

  console.log("[v0] Search params:", { q, city, country, category, dateFrom, dateTo, isEventQuery })
  if (city) {
    console.log(`[v0] ⚠️ FILTERING BY CITY: "${city}"${country ? `, COUNTRY: "${country}"` : ""}`)
  } else {
    console.log(`[v0] ⚠️ NO CITY FILTER - search will be broad`)
  }

  if (isEventQuery) {
    console.log(`[v0] 🎯 Event-intent query detected: "${q}" - will apply strict location filtering and automatic web fallback if no internal events`)
  }

  const phase1Interpretation = buildPhase1Interpretation({
    q,
    interpreted: lastInterpreted,
    interpretThrew: lastInterpretError,
    executionCategory: category,
    executionDateFrom: dateFrom,
    executionDateTo: dateTo,
    executionPlace: { city, country },
    parsedIntent,
  })

  try {
    if (!q) {
      // BUILD WHERE CLAUSE IN PRIORITY ORDER:
      // 1. Location (city/country) - FIRST PRIORITY
      // 2. Date (always forward of today) - SECOND PRIORITY
      // 3. Category - LOWER PRIORITY

      const where: any = {
        ...PUBLIC_EVENT_WHERE,
      }

      // PRIORITY 1: LOCATION FILTERS (city/country) - applied first
      if (city) {
        const locationMode =
          effectiveLocation.source === "query" ? "explicit_query" : "inclusive"
        where.AND = where.AND || []
        where.AND.push(buildStructuredCityLocationOrClause(city, locationMode))
      }
      if (regionCountriesForFilter && regionCountriesForFilter.length > 0) {
        applyRegionCountriesWhere(where, regionCountriesForFilter)
      } else if (country) {
        where.country = { contains: country, mode: "insensitive" }
      }

      // PRIORITY 2: DATE FILTER - use overlap logic for multi-day events
      // Overlap rule: event.startAt <= searchEnd AND event.endAt >= searchStart
      if (dateFrom && dateTo) {
        const dateFromDate = new Date(dateFrom)
        const dateToDate = new Date(dateTo)
        const searchStart = dateFromDate > now ? dateFromDate : now
        const dateOverlap = buildDateRangeOverlapWhere(searchStart, dateToDate)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (range overlap): searchStart=${searchStart.toISOString()}, searchEnd=${dateToDate.toISOString()}`)
      } else if (dateFrom) {
        const dateFromDate = new Date(dateFrom)
        const searchStart = dateFromDate > now ? dateFromDate : now
        const dateOverlap = buildDateOverlapWhere(searchStart, null)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (start overlap): searchStart=${searchStart.toISOString()}`)
      } else if (dateTo) {
        const dateToDate = new Date(dateTo)
        const dateOverlap = buildDateOverlapWhere(now, dateToDate)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (end overlap): searchEnd=${dateToDate.toISOString()}`)
      } else {
        // Default: events must end after now (ongoing or future events)
        const dateOverlap = buildDateOverlapWhere(now, null)
        Object.assign(where, dateOverlap)
        console.log(`[v0] Date filter (default overlap): events ending after ${now.toISOString()}`)
      }

      // PRIORITY 3: CATEGORY - applied after location and date
      if (shouldStrictCategoryFilter && category && category !== "all") {
        const categoryEnum = category.toUpperCase() as EventCategory
        where.category = categoryEnum
      }

      let events, count
      try {
        [events, count] = await Promise.all([
          withLanguageColumnGuard(() => prisma.event.findMany({
          where,
            orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
            take,
            skip,
          })),
          prisma.event.count({ where }),
        ])
      } catch (error: any) {
        // If language column is missing, retry with explicit select excluding language
        if (!isLanguageFilteringAvailable()) {
          try {
            [events, count] = await Promise.all([
              prisma.event.findMany({
                where,
                select: getEventSelectWithoutLanguage(),
          orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
          take,
          skip,
        }),
        prisma.event.count({ where }),
      ])
          } catch (retryError: any) {
            console.error("[SEARCH FALLBACK] Retry query also failed:", retryError?.message)
            emitSearchEventsComplete({
              internalCount: 0,
              externalCount: 0,
              totalReturned: 0,
              includesWeb: false,
              webCalled: false,
              emptyState: false,
              isEventIntent: false,
            })
            return NextResponse.json({
              events: [],
              count: 0,
              page: 1,
              take,
              internal: [],
              external: [],
              total: 0,
              phase1Interpretation,
            })
          }
        } else {
          // Some other error - rethrow
          throw error
        }
      }
      const noQueryInternal = (events as any[]).map((e: any) => ({
        ...e,
        source: "internal" as const,
        isEventaEvent: true,
      }))
      emitSearchEventsComplete({
        internalCount: noQueryInternal.length,
        externalCount: 0,
        totalReturned: count,
        includesWeb: false,
        webCalled: false,
        emptyState: false,
        isEventIntent: false,
      })
      return NextResponse.json({
        events: noQueryInternal,
        count,
        page,
        take,
        internal: noQueryInternal,
        external: [],
        total: count,
        emptyState: false,
        includesWeb: false,
        isEventIntent: false,
        phase1Interpretation,
      })
    }

    // Clean query: remove city if provided as separate filter, but keep category terms for better matching
    let cleanedQuery = q
    if (city) {
      // Remove city name from query (case-insensitive) to avoid double-matching
      const cityRegex = new RegExp(`\\b${city}\\b`, "gi")
      cleanedQuery = cleanedQuery.replace(cityRegex, "").trim()
    }
    // Don't remove category from query - it helps with text matching
    // The category filter will be applied separately as a filter
    
    // Clean up multiple spaces
    cleanedQuery = cleanedQuery.replace(/\s+/g, " ").trim()
    
    // Remove obvious time-intent words/phrases from the TEXT matching layer.
    // These are still implicitly respected via the date overlap logic and ranking,
    // but we don't require them to appear in the event text.
    const timePhrasePatterns = [
      /\bthis\s+weekend\b/gi,
      /\bthis\s+week\b/gi,
      /\btonight\b/gi,
      /\btoday\b/gi,
      /\btomorrow\b/gi,
      /\bfriday\b/gi,
      /\bsaturday\b/gi,
      /\bsunday\b/gi,
      /\bweekend\b/gi,
    ]
    // Scope-only tokens (handled via search plan / detectScope); must not constrain text matching.
    const scopePhrasePatterns = [/\b(worldwide|anywhere|global)\b/gi]
    // Note: these time phrases are handled via date/ranking logic, not required text matches.
    let textQuery = cleanedQuery
    timePhrasePatterns.forEach((re) => {
      textQuery = textQuery.replace(re, " ")
    })
    scopePhrasePatterns.forEach((re) => {
      textQuery = textQuery.replace(re, " ")
    })
    textQuery = textQuery.replace(/\s+/g, " ").trim()
    textQuery = stripTextSearchStopwords(textQuery)

    // If cleaned query is empty but we have filters, use empty string (will search by filters only)
    // If cleaned query is not empty, use textQuery for text matching (with time words removed)

    console.log(
      "[v0] Cleaned query:",
      cleanedQuery,
      "textQuery:",
      textQuery,
      "from original:",
      q,
      "city:",
      city,
      "category:",
      category,
    )

    // BUILD WHERE CLAUSE IN PRIORITY ORDER:
    // 1. Location (city/country) - FIRST PRIORITY
    // 2. Date (always forward of today) - SECOND PRIORITY
    // 3. Text search, category, etc. - LOWER PRIORITY

    const where: any = {
      ...PUBLIC_EVENT_WHERE,
    }

    // PRIORITY 1: LOCATION FILTERS — structured `city` / `parentCity` (+ query vs UI behavior)
    if (city) {
      const cityLower = city.toLowerCase().trim()
      const variations = EXECUTION_CITY_VARIATIONS[cityLower] || []
      const allCityNames = [cityLower, ...variations]
      const locationMode =
        effectiveLocation.source === "query" ? "explicit_query" : "inclusive"
      where.AND = where.AND || []
      where.AND.push(buildStructuredCityLocationOrClause(city, locationMode))
      console.log(
        `[v0] City filter (${locationMode}): ${city} → [${allCityNames.join(", ")}]`,
      )
    }

    if (regionCountriesForFilter && regionCountriesForFilter.length > 0) {
      applyRegionCountriesWhere(where, regionCountriesForFilter)
    } else if (country) {
      where.country = { contains: country, mode: "insensitive" }
    }

    // PRIORITY 2: DATE FILTER - use overlap logic for multi-day events
    // Overlap rule: event.startAt <= searchEnd AND event.endAt >= searchStart
    // This ensures:
    // - Ongoing events (started in past, still running) are included
    // - Finished events (ended before search window) are excluded
    // - Future events are included if they overlap the search window
    if (dateFrom && dateTo) {
      // Specific date range: use overlap logic for the range
      const dateFromDate = new Date(dateFrom)
      const dateToDate = new Date(dateTo)
      const searchStart = dateFromDate > now ? dateFromDate : now
      const dateOverlap = buildDateRangeOverlapWhere(searchStart, dateToDate)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (range overlap): searchStart=${searchStart.toISOString()}, searchEnd=${dateToDate.toISOString()}`)
    } else if (dateFrom) {
      // Start date only: events must end after search start
      const dateFromDate = new Date(dateFrom)
      const searchStart = dateFromDate > now ? dateFromDate : now
      const dateOverlap = buildDateOverlapWhere(searchStart, null)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (start overlap): searchStart=${searchStart.toISOString()}`)
    } else if (dateTo) {
      // End date only: events must start before search end and end after now
      const dateToDate = new Date(dateTo)
      const dateOverlap = buildDateOverlapWhere(now, dateToDate)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (end overlap): searchEnd=${dateToDate.toISOString()}`)
    } else {
      // Default: events must end after now (ongoing or future events)
      const dateOverlap = buildDateOverlapWhere(now, null)
      Object.assign(where, dateOverlap)
      console.log(`[v0] Date filter (default overlap): events ending after ${now.toISOString()}`)
    }

    // PRIORITY 3: TEXT SEARCH AND CATEGORY - applied after location and date
    // Build OR clause for text search (only if we have remaining non-time terms).
    // Uses phrase-level expansion: "garage sale", "live music", "art show" etc.
    // IMPORTANT: term groups are built from the time-stripped textQuery so that
    // phrases like "this weekend" don't over-constrain the text search.
    if (textQuery) {
      const termGroups = getExpandedTermGroups(textQuery)
      const textSearchConditions: any[] = []

      if (termGroups.length > 0) {
        termGroups.forEach((terms) => {
          const wordConditions: any[] = []
          terms.forEach((term) => {
            wordConditions.push(
              { title: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
              { venueName: { contains: term, mode: "insensitive" } },
              { city: { contains: term, mode: "insensitive" } },
              { country: { contains: term, mode: "insensitive" } },
            )
          })
          textSearchConditions.push({ OR: wordConditions })
        })
      }

      if (textSearchConditions.length > 0) {
        where.AND = where.AND || []
        where.AND.push(...textSearchConditions)
      }
      // If there are no term groups, fall through and rely on location/date/category only.
    }

    // Snapshot the current where-clause without category so we can relax category intent
    // if strict filtering leads to empty internal results.
    const whereWithoutCategory = structuredClone(where)

    // Apply category filter
    if (shouldStrictCategoryFilter && category && category !== "all") {
      // Map category string to EventCategory enum
      const categoryMap: Record<string, EventCategory> = {
        food: "FOOD_DRINK",
        music: "MUSIC_NIGHTLIFE",
        arts: "ARTS_CULTURE",
        comedy: "ARTS_CULTURE",
        sports: "SPORTS_OUTDOORS",
        family: "FAMILY_KIDS",
        community: "COMMUNITY_CAUSES",
        learning: "LEARNING_TALKS",
        markets: "MARKETS_FAIRS",
        online: "ONLINE_VIRTUAL",
      }
      const normalizedCategory = category.toLowerCase()
      const categoryEnum = categoryMap[normalizedCategory] || (category.toUpperCase() as EventCategory)
      
      // Check both the category field and the categories array
      const categoryConditions: any[] = [
        { category: categoryEnum },
        { categories: { hasSome: [category, normalizedCategory, categoryEnum] } },
      ]
      
      // Combine category filter with existing conditions
      // Since we're using AND structure for text search, add category to AND as well
      if (where.AND && Array.isArray(where.AND) && where.AND.length > 0) {
        // We already have AND conditions (city filter and/or text search), add category
        where.AND.push({ OR: categoryConditions })
      } else if (where.OR && Array.isArray(where.OR) && where.OR.length > 0) {
        // Legacy: if we somehow have OR conditions, convert to AND structure
        const textSearchOR = where.OR
        delete where.OR
        where.AND = [
          { OR: textSearchOR },
          { OR: categoryConditions },
        ]
      } else {
        // No text search or city filter, just filter by category
        where.AND = where.AND || []
        where.AND.push({ OR: categoryConditions })
      }
    }

    console.log("[v0] Final where clause:", JSON.stringify(where, null, 2))
    console.log("[v0] Search query breakdown:", {
      originalQuery: q,
      cleanedQuery,
      textQuery,
      termGroups: cleanedQuery ? getExpandedTermGroups(textQuery || cleanedQuery).length : 0,
      cityFilter: city,
      countryFilter: country,
      categoryFilter: category,
      dateFrom,
      dateTo,
      publicEventWhere: PUBLIC_EVENT_WHERE,
    })
    
    // Debug: Check if we're filtering by city and what variations we're using
    if (city) {
      const cityLower = city.toLowerCase().trim()
      const variations = EXECUTION_CITY_VARIATIONS[cityLower] || []
      console.log(`[v0] City filter will match: ${city} and variations: [${variations.join(", ")}]`)
    }

    const whereSnapshotForAmbientRetry = structuredClone(where)

    let events, count
    try {
      [events, count] = await Promise.all([
        withLanguageColumnGuard(() => prisma.event.findMany({
        where,
          orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
          take,
          skip,
        })),
        prisma.event.count({ where }),
      ])
    } catch (error: any) {
      // If language column is missing, retry with explicit select excluding language
      if (!isLanguageFilteringAvailable()) {
        try {
          [events, count] = await Promise.all([
            prisma.event.findMany({
              where,
              select: getEventSelectWithoutLanguage(),
        orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
      prisma.event.count({ where }),
    ])
        } catch (retryError: any) {
          console.error("[SEARCH FALLBACK] Retry query also failed:", retryError?.message)
          emitSearchEventsComplete({
            internalCount: 0,
            externalCount: 0,
            totalReturned: 0,
            includesWeb: false,
            webCalled: false,
            emptyState: false,
            isEventIntent: isEventQuery,
          })
          return NextResponse.json({
            events: [],
            count: 0,
            page,
            take,
            internal: [],
            external: [],
            total: 0,
            phase1Interpretation,
          })
        }
      } else {
        // Some other error - rethrow
        throw error
      }
    }

    // If category intent was too rigid (0 internal results), retry without the strict category constraint.
    // This keeps category as an intent signal (filter/boost) without collapsing relevant results.
    if (count === 0 && shouldStrictCategoryFilter && category && category !== "all" && whereWithoutCategory) {
      console.log("[v0] ⚠️ Category filter returned 0 results; retrying without strict category constraint.")
      try {
        ;[events, count] = await Promise.all([
          withLanguageColumnGuard(() =>
            prisma.event.findMany({
              where: whereWithoutCategory,
              orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
              take,
              skip,
            }),
          ),
          prisma.event.count({ where: whereWithoutCategory }),
        ])
      } catch (retryError: any) {
        // Mirror initial "missing language column" fallback.
        if (!isLanguageFilteringAvailable()) {
          try {
            ;[events, count] = await Promise.all([
              prisma.event.findMany({
                where: whereWithoutCategory,
                select: getEventSelectWithoutLanguage(),
                orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
                take,
                skip,
              }),
              prisma.event.count({ where: whereWithoutCategory }),
            ])
          } catch (retryError2: any) {
            console.warn(
              "[v0] Category-relax retry failed; keeping original empty results.",
              retryError2?.message || String(retryError2),
            )
          }
        } else {
          console.warn(
            "[v0] Category-relax retry failed; keeping original empty results.",
            retryError?.message || String(retryError),
          )
        }
      }
    }

    // Strict internal location enforcement: structured `event.city` (always); `parentCity` only for UI/device execution.
    const eventsBeforeStrict = events
    const strict1 = applyStrictInternalCityFilter(events, city, {
      allowParentCityMatch: effectiveLocation.source !== "query",
    })
    events = strict1.events
    count = strict1.count
    if (
      city &&
      !eventsBeforeStrict.some((e: any) => String(e?.city || "").trim().length > 0)
    ) {
      console.log(
        `[v0] 🔎 Skipping strict internal city filtering for "${city.toLowerCase().trim()}" because city fields are missing across results.`,
      )
    }

    let parentMetro: string | null = null
    if (
      city &&
      ambientSuburbParentExpansionEligible({
        q,
        executionCity: city,
        internalCountAfterStrict: count,
        effectiveLocationSource: effectiveLocation.source,
        scope: searchPlan.scope,
        parsedIntent,
      })
    ) {
      const key = city.toLowerCase().trim()
      parentMetro =
        (await fetchParentMetroFromStoredEvents(city)) ?? AMBIENT_SUBURB_PARENT_CITY[key] ?? null
    }
    if (parentMetro) {
      const whereExpanded = structuredClone(whereSnapshotForAmbientRetry)
      const whereExpandedNoCat = structuredClone(whereWithoutCategory)
      const replaced =
        replaceExecutionCityInWhere(whereExpanded, parentMetro) &&
        replaceExecutionCityInWhere(whereExpandedNoCat, parentMetro)
      if (replaced) {
        console.log(
          `[v0] 🏘️ Ambient suburb thin internal (${count}); retrying execution with parent metro "${parentMetro}"`,
        )
        try {
          let ev2: any[]
          let ct2: number
          ;[ev2, ct2] = await Promise.all([
            withLanguageColumnGuard(() =>
              prisma.event.findMany({
                where: whereExpanded,
                orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
                take,
                skip,
              }),
            ),
            prisma.event.count({ where: whereExpanded }),
          ])
          if (ct2 === 0 && shouldStrictCategoryFilter && category && category !== "all" && whereExpandedNoCat) {
            console.log("[v0] ⚠️ Expanded parent-city query returned 0; retrying without strict category constraint.")
            ;[ev2, ct2] = await Promise.all([
              withLanguageColumnGuard(() =>
                prisma.event.findMany({
                  where: whereExpandedNoCat,
                  orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
                  take,
                  skip,
                }),
              ),
              prisma.event.count({ where: whereExpandedNoCat }),
            ])
          }
          const strict2 = applyStrictInternalCityFilter(ev2, parentMetro, {
            allowParentCityMatch: true,
          })
          events = strict2.events
          count = strict2.count
          city = parentMetro
          effectiveCity = parentMetro
          ambientParentExpansionApplied = true
        } catch (expandErr: any) {
          if (!isLanguageFilteringAvailable()) {
            try {
              let ev2: any[]
              let ct2: number
              ;[ev2, ct2] = await Promise.all([
                prisma.event.findMany({
                  where: whereExpanded,
                  select: getEventSelectWithoutLanguage(),
                  orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
                  take,
                  skip,
                }),
                prisma.event.count({ where: whereExpanded }),
              ])
              if (ct2 === 0 && shouldStrictCategoryFilter && category && category !== "all" && whereExpandedNoCat) {
                ;[ev2, ct2] = await Promise.all([
                  prisma.event.findMany({
                    where: whereExpandedNoCat,
                    select: getEventSelectWithoutLanguage(),
                    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
                    take,
                    skip,
                  }),
                  prisma.event.count({ where: whereExpandedNoCat }),
                ])
              }
              const strict2 = applyStrictInternalCityFilter(ev2, parentMetro, {
                allowParentCityMatch: true,
              })
              events = strict2.events
              count = strict2.count
              city = parentMetro
              effectiveCity = parentMetro
              ambientParentExpansionApplied = true
            } catch {
              console.warn("[v0] Ambient suburb expansion (language fallback) failed; keeping suburb results.", expandErr?.message)
            }
          } else {
            console.warn("[v0] Ambient suburb expansion failed; keeping suburb results.", expandErr?.message || String(expandErr))
          }
        }
      } else {
        console.warn("[v0] Ambient suburb expansion skipped: could not locate city filter clause in where snapshot.")
      }
    }

    if (ambientParentExpansionApplied && effectiveCity) {
      effectiveLocation.city = effectiveCity
    }

    console.log("[v0] Search query:", q, "filters:", { city, country, category, dateFrom, dateTo }, "found:", count, "internal events")
    if (count === 0 && q) {
      console.log("[v0] ⚠️ No internal events found for query. Possible reasons:")
      console.log("  - Event doesn't match text search terms (title/description)")
      console.log("  - Event moderationStatus is not APPROVED")
      console.log("  - Event status is not PUBLISHED")
      console.log("  - Event date is in the past")
      if (city) console.log(`  - Event city doesn't match filter: "${city}"`)
      if (country) console.log(`  - Event country doesn't match filter: "${country}"`)
    }

    // EVENT-INTENT QUERY BEHAVIOR:
    // For event-intent queries with location set, automatically fetch web results if no internal events found
    // This provides local event discovery while maintaining strict location constraints
    let webResults: any[] = []
    let debugTrace: any = {
      internalCount: events.length,
      webCalled: false,
      webQuery: null,
      webRawCount: 0,
      webAfterLocationCount: 0,
      webAfterEventinessCount: 0,
      webAfterDateCount: 0,
      finalReturnedInternalCount: 0,
      finalReturnedWebCount: 0,
      webError: null,
      sampleWebTitles: [],
      effectiveLocation: effectiveLocation,
      microLocation: microLocation || null,
      webQueriesUsed: [] as string[],
      webAfterMicroLocationCount: 0,
      topDomains: [] as string[],
    }
    
    // Web fallback: event-intent needs geo context (city/country, region label/countries, or global scope).
    const shouldSearchWeb =
      q.trim().length > 0 &&
      (!isEventQuery || (isEventQuery && events.length === 0 && hasWebGeoContext))

    // CRITICAL: If internal is 0 and geo context exists, web search MUST be called
    if (events.length === 0 && hasWebGeoContext && q.trim().length > 0 && !shouldSearchWeb) {
      console.warn(
        `[v0] ⚠️ WARNING: Internal results empty, geo context set (${effectiveCity || ""}, ${effectiveCountry || ""}, region=${effectiveLocation.region || ""}), but web search not triggered!`,
      )
      // Force web search
      debugTrace.webCalled = true
    }
    
    if (isEventQuery && events.length === 0 && shouldSearchWeb) {
      console.log(`[v0] 🔄 Event-intent query with no internal events: automatically fetching web results (effectiveLocation: ${effectiveCity || 'none'}${effectiveCountry ? `, ${effectiveCountry}` : ''})`)
    } else if (isEventQuery && events.length > 0) {
      console.log(`[v0] ✅ Event-intent query: ${events.length} internal events found, skipping web search`)
    }
    
    if (shouldSearchWeb) {
      debugTrace.webCalled = true
      const hasGoogleConfig = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_PSE_ID)
      console.log("[v0] Searching web...", { 
        hasGoogleConfig, 
        hasApiKey: !!process.env.GOOGLE_API_KEY, 
        hasPseId: !!process.env.GOOGLE_PSE_ID 
      })
      
      try {
        // Build web search queries using LOCATION CONTROL (city/country from params, not query extraction)
        // CRITICAL: Use city/country from URL params (set by UI location picker), not from query text
        
        // If micro-location is detected, try micro-location query first
        let webQueries: string[] = []
        
        // E1: Multi-query CSE merge - Run 2-3 queries in parallel and merge/dedupe
        // Use effectiveCity/effectiveCountry (not city/country params)
        if (microLocation && effectiveCity) {
          // Micro-location queries
          const baseQuery = q.replace(new RegExp(`\\b(in|near|around)\\s+${microLocation}\\b`, "gi"), "").trim()
          
          // Query 1: Micro-location with full context
          let microQuery = `${baseQuery} "${microLocation}" ${effectiveCity}`
          if (effectiveCountry) microQuery = `${microQuery} ${effectiveCountry}`
          if (category && category !== "all") microQuery = `${microQuery} ${category}`
          if (!microQuery.toLowerCase().includes("event")) microQuery = `${microQuery} events`
          webQueries.push(microQuery.trim())
          
          // Query 2: Alternative format for gig guides
          let altQuery = `${microLocation} ${effectiveCity}`
          if (effectiveCountry) altQuery = `${altQuery} ${effectiveCountry}`
          if (baseQuery) altQuery = `${baseQuery} ${altQuery}`
          if (!altQuery.toLowerCase().includes("event")) altQuery = `${altQuery} events`
          webQueries.push(altQuery.trim())
          
          // Query 3: Micro-location live music events
          let microQuery3 = `${microLocation} ${effectiveCity} live music events`
          if (effectiveCountry) microQuery3 = `${microQuery3} ${effectiveCountry}`
          webQueries.push(microQuery3.trim())
        }
        
        // Always add city-level queries (fallback if micro-location query returns 0)
        let cityQuery1 = topicQueryForCityLevelWeb(q, parsedIntent, searchPlan.location.source)
        if (effectiveCity) {
          const cityLower = effectiveCity.toLowerCase().trim()
          if (!cityQuery1.toLowerCase().includes(cityLower)) {
            cityQuery1 = `${cityQuery1} ${effectiveCity}`
          }
          
          if (effectiveCountry) {
            const countryLower = effectiveCountry.toLowerCase()
            if (!cityQuery1.toLowerCase().includes(countryLower)) {
              cityQuery1 = `${cityQuery1} ${effectiveCountry}`
            }
          } else {
            // Use defaults for ambiguous cities
            const ambiguousCities: Record<string, string> = {
              "melbourne": "Australia",
              "ithaca": "",
              "ithaki": "Greece",
              "cambridge": "",
              "naples": "Italy",
              "berlin": "Germany",
              "paris": "France",
              "london": "UK",
              "rome": "Italy",
              "athens": "Greece",
              "milan": "Italy",
              "vienna": "Austria",
              "madrid": "Spain",
            }
            if (ambiguousCities[cityLower]) {
              cityQuery1 = `${cityQuery1} ${ambiguousCities[cityLower]}`
            }
          }
        } else if (effectiveCountry && !cityQuery1.toLowerCase().includes(effectiveCountry.toLowerCase())) {
          cityQuery1 = `${cityQuery1} ${effectiveCountry}`
        } else if (searchPlan.scope === "region" && (searchPlan.location.region || regionCountriesForFilter?.length)) {
          const parts = [searchPlan.location.region, regionCountriesForFilter?.join(" ")].filter(Boolean)
          const tail = parts.join(" ").trim()
          if (tail) {
            const alreadyCovered = parts.some(
              (p) => p && cityQuery1.toLowerCase().includes(String(p).toLowerCase()),
            )
            if (!alreadyCovered) cityQuery1 = `${cityQuery1} ${tail}`.trim()
          }
        }

        if (category && category !== "all" && !cityQuery1.toLowerCase().includes(category.toLowerCase())) {
          cityQuery1 = `${cityQuery1} ${category}`
        }
        if (!cityQuery1.toLowerCase().includes("event")) {
          cityQuery1 = `${cityQuery1} events`
        }
        
        // Query 2/3: Activity-specific web fallbacks (avoid always using "live music")
        const webIntentCategory =
          category && category !== "all" ? category : rankingCategoryFromParsedIntent(parsedIntent)
        const webActivity = (() => {
          switch ((webIntentCategory || "").toLowerCase()) {
            case "music":
              return { phrase: "live music", useGigGuides: true }
            case "markets":
            case "market":
              return { phrase: "markets", useGigGuides: false }
            case "food":
              return { phrase: "food and drink", useGigGuides: false }
            case "arts":
              return { phrase: "arts and exhibitions", useGigGuides: false }
            case "family":
              return { phrase: "family events", useGigGuides: false }
            case "community":
              return { phrase: "community events", useGigGuides: false }
            case "learning":
              return { phrase: "talks and workshops", useGigGuides: false }
            default:
              return null
          }
        })()

        if (effectiveCity && webActivity) {
          if (webActivity.useGigGuides) {
            let cityQuery2 = `${effectiveCity} gig guide ${webActivity.phrase}`
            if (effectiveCountry) cityQuery2 = `${cityQuery2} ${effectiveCountry}`
            webQueries.push(cityQuery2.trim())
          } else {
            let cityQuery2 = `${effectiveCity} ${webActivity.phrase}`
            if (effectiveCountry) cityQuery2 = `${cityQuery2} ${effectiveCountry}`
            webQueries.push(cityQuery2.trim())
          }

          let cityQuery3 = `${effectiveCity} what's on ${webActivity.phrase}`
          if (effectiveCountry) cityQuery3 = `${cityQuery3} ${effectiveCountry}`
          webQueries.push(cityQuery3.trim())
        } else if (effectiveCity) {
          // Generic listing fallback when we can't infer an activity category confidently.
          let cityQuery2 = `${effectiveCity} what's on events`
          if (effectiveCountry) cityQuery2 = `${cityQuery2} ${effectiveCountry}`
          webQueries.push(cityQuery2.trim())
        } else if (searchPlan.scope === "region" && searchPlan.location.region) {
          const r = searchPlan.location.region
          if (webActivity) {
            webQueries.push(`${r} ${webActivity.phrase} events`.trim())
            webQueries.push(`${r} what's on ${webActivity.phrase}`.trim())
          } else {
            webQueries.push(`${r} what's on events`.trim())
          }
        }
        
        // Add city-level query 1 (only if not already in micro-location queries)
        const cityQuery1Trimmed = cityQuery1.trim()
        if (!microLocation || !webQueries.includes(cityQuery1Trimmed)) {
          webQueries.push(cityQuery1Trimmed)
        }
        
        debugTrace.webQueriesUsed = webQueries
        
        // E1: Execute web searches in parallel and merge/dedupe by canonical URL
        console.log(`[v0] Running ${webQueries.length} web queries in parallel...`)
        const webSearchPromises = webQueries.map((webQuery) =>
          searchWeb({
            query: webQuery,
            limit: 10,
            searchCountryName: effectiveCountry,
          }).catch((err) => {
            console.error(`[v0] Web search failed for query "${webQuery}":`, err)
            return []
          }),
        )
        
        const webSearchResultsArrays = await Promise.all(webSearchPromises)
        
        // Merge and dedupe by URL
        const urlMap = new Map<string, any>()
        for (const results of webSearchResultsArrays) {
          for (const result of results) {
            if (result.url && !urlMap.has(result.url)) {
              urlMap.set(result.url, result)
            }
          }
        }
        
        let webSearchResults = Array.from(urlMap.values())
        debugTrace.webRawCount = webSearchResults.length
        console.log(`[v0] Merged ${webSearchResults.length} unique web results from ${webQueries.length} queries`)
        
        // Transform web results to match expected format (both internal and external formats)
        // Do not label web rows with effectiveCity/effectiveCountry — CSE does not give per-result locality;
        // injecting scope would falsely imply the hit is in that city and pollutes text-based filters.
        let transformedWebResults = webSearchResults.map((result, index) => {
          return {
            id: `web-${Date.now()}-${index}`,
            title: result.title,
            description: result.snippet || "",
            startAt: result.startAt,
            endAt: result.startAt, // Use same as start if no end date
            city: "",
            country: "",
            address: "",
            venueName: "",
            categories: category && category !== "all" ? [category] : [],
            priceFree: false,
            imageUrls: result.imageUrl ? [result.imageUrl] : [],
            status: "PUBLISHED" as const,
            aiStatus: "SAFE" as const,
            source: "web" as const,
            externalUrl: result.url,
            imageUrl: result.imageUrl || undefined, // Preserve imageUrl from web search
            // Also include location object for compatibility with external format
            location: {
              city: "",
              country: "",
              address: "",
            },
            // Store original URL for eventness scoring
            _originalUrl: result.url,
            _originalSnippet: result.snippet || "",
          }
        })
        
        // E2: Eventness gating - Filter out non-events (PDFs, reports, cruises, homepages)
        const beforeEventnessFilter = transformedWebResults.length
        transformedWebResults = transformedWebResults.filter((result) => {
          const url = (result._originalUrl || result.externalUrl || "").toLowerCase()
          const title = (result.title || "").toLowerCase()
          const snippet = (result._originalSnippet || result.description || "").toLowerCase()
          const fullText = `${title} ${snippet}`.toLowerCase()
          
          // Exclude PDFs
          if (url.endsWith('.pdf') || url.includes('/pdf/')) {
            console.log(`[v0] 🚫 E2 EXCLUDED: PDF file - "${result.title?.substring(0, 50)}"`)
            return false
          }
          
          // Exclude reports, studies, census, executive summaries
          const junkPatterns = [
            /\bcensus\b/i,
            /\bexecutive\s+summary\b/i,
            /\breport\b/i,
            /\bstudy\b/i,
            /\bsubmission\b/i,
            /\bresearch\b/i,
            /\banalysis\b/i,
            /\bwhitepaper\b/i,
          ]
          
          if (junkPatterns.some(pattern => pattern.test(fullText))) {
            console.log(`[v0] 🚫 E2 EXCLUDED: Junk content (report/census) - "${result.title?.substring(0, 50)}"`)
            return false
          }
          
          // Exclude obvious non-event commercial promos (cruises/tours when query is live music)
          if (q.toLowerCase().includes("live music") || q.toLowerCase().includes("music")) {
            if (fullText.includes("cruise") && !fullText.includes("music cruise")) {
              console.log(`[v0] 🚫 E2 EXCLUDED: Cruise promo (not music event) - "${result.title?.substring(0, 50)}"`)
              return false
            }
          }
          
          // Exclude generic root homepages with no listing cues
          // Very short path + no "events/calendar/whats-on/gig" cues
          const urlPath = url.split("/").filter((p: string) => p).length
          const hasListingCues = /(gig|gig-guide|whats-on|whatson|events|calendar|what-s-on|program)/i.test(url + fullText)
          if (urlPath <= 2 && !hasListingCues) {
            console.log(`[v0] 🚫 E2 EXCLUDED: Generic homepage (no listing cues) - "${result.title?.substring(0, 50)}"`)
            return false
          }
          
          return true
        })
        
        debugTrace.webAfterEventinessCount = transformedWebResults.length
        if (beforeEventnessFilter !== transformedWebResults.length) {
          console.log(`[v0] E2 Eventness filter: ${beforeEventnessFilter} → ${transformedWebResults.length} results`)
        }
        
        // MICRO-LOCATION FILTER: If micro-location was used, filter results to mention it
        // Store original results before filtering for fallback
        const resultsBeforeMicroFilter = [...transformedWebResults]
        
        if (microLocation && transformedWebResults.length > 0) {
          const microLocLower = microLocation.toLowerCase()
          const beforeMicroFilter = transformedWebResults.length
          
          transformedWebResults = transformedWebResults.filter((result) => {
            const orig = (result as { _originalSnippet?: string })._originalSnippet || ""
            const resultText = `${result.title || ""} ${result.description || ""} ${orig} ${result.externalUrl || ""}`.toLowerCase()
            return resultText.includes(microLocLower)
          })
          
          debugTrace.webAfterMicroLocationCount = transformedWebResults.length
          
          if (beforeMicroFilter !== transformedWebResults.length) {
            console.log(`[v0] Micro-location filter: ${beforeMicroFilter} → ${transformedWebResults.length} results mentioning "${microLocation}"`)
          }
          
          // FALLBACK: If micro-location filter returns 0, fall back to city-level results (already fetched)
          if (transformedWebResults.length === 0) {
            console.log(`[v0] ⚠️ Micro-location filter returned 0 results, falling back to city-level results`)
            // If we have multiple queries, the last one is city-level - use all results before micro-filter
            // Otherwise, re-run city-level query as fallback
            if (resultsBeforeMicroFilter.length > 0) {
              // Use the results we already have (from city-level query)
              transformedWebResults = resultsBeforeMicroFilter
              debugTrace.webAfterMicroLocationCount = transformedWebResults.length
              console.log(`[v0] Using city-level results as fallback: ${transformedWebResults.length} results`)
            } else if (webQueries.length > 1) {
              // No results from micro-location query, try city-level query
              const cityQuery = webQueries[webQueries.length - 1] // Last query is city-level
              console.log(`[v0] Re-running city-level query as fallback: ${cityQuery}`)
              const fallbackResults = await searchWeb({
                query: cityQuery,
                limit: 10,
                searchCountryName: effectiveCountry,
              })
              
              transformedWebResults = fallbackResults.map((result, index) => {
                return {
                  id: `web-fallback-${Date.now()}-${index}`,
                  title: result.title,
                  description: result.snippet || "",
                  startAt: result.startAt,
                  endAt: result.startAt,
                  city: "",
                  country: "",
                  address: "",
                  venueName: "",
                  categories: category && category !== "all" ? [category] : [],
                  priceFree: false,
                  imageUrls: result.imageUrl ? [result.imageUrl] : [],
                  status: "PUBLISHED" as const,
                  aiStatus: "SAFE" as const,
                  source: "web" as const,
                  _originalUrl: result.url,
                  _originalSnippet: result.snippet || "",
                  externalUrl: result.url,
                  imageUrl: result.imageUrl || undefined,
                  location: {
                    city: "",
                    country: "",
                    address: "",
                  },
                }
              })
              
              // Apply junk filter to fallback results
              transformedWebResults = transformedWebResults.filter((result) => {
                if (result.externalUrl && result.externalUrl.toLowerCase().endsWith('.pdf')) return false
                const fullText = `${result.title || ""} ${result.description || ""}`.toLowerCase()
                const junkPatterns = [/\bcensus\b/i, /\bexecutive\s+summary\b/i, /\breport\b/i, /\bstudy\b/i, /\bsubmission\b/i]
                return !junkPatterns.some(pattern => pattern.test(fullText))
              })
              
              debugTrace.webAfterMicroLocationCount = transformedWebResults.length
            }
          }
        }
        
        // Filter web results by city if specified
        // NOTE: Web search already filtered by city in the query, so we only need to exclude obvious mismatches
        // Don't require city to appear in every result's text - trust Google's search relevance
        if (city) {
          const cityLower = city.toLowerCase().trim()
          const beforeCityFilter = transformedWebResults.length
          
          // Known ambiguous cities that need country disambiguation
          const ambiguousCities: Record<string, string[]> = {
            "melbourne": ["australia", "florida", "usa"],
            "ithaca": ["greece", "new york", "usa"],
            "ithaki": ["greece"],
            "cambridge": ["united kingdom", "uk", "massachusetts", "usa"],
            "naples": ["italy", "florida", "usa"],
            "berlin": ["germany", "maryland", "usa"],
            "paris": ["france", "texas", "usa"],
            "london": ["united kingdom", "uk", "ontario", "canada"],
            "rome": ["italy", "georgia", "usa"],
            "athens": ["greece", "georgia", "usa"],
            "milan": ["italy", "tennessee", "usa"],
            "vienna": ["austria", "virginia", "usa"],
            "madrid": ["spain", "new mexico", "usa"],
          }
          
          // US cities to exclude when searching from Australia
          const knownUSCities = [
            "fort worth", "austin", "seneca", "dallas", "houston", "boston", "kansas city", "phoenix",
            "chicago", "los angeles", "new york", "san francisco", "seattle", "denver", "miami",
            "atlanta", "philadelphia", "san diego", "detroit", "minneapolis", "portland", "orlando"
          ]
          
          // US states to check for
          const usStates = [
            "texas", "california", "florida", "new york", "pennsylvania", "illinois", "ohio", "georgia",
            "north carolina", "michigan", "new jersey", "virginia", "washington", "arizona", "massachusetts"
          ]
          
          const isAmbiguous = ambiguousCities[cityLower] !== undefined
          const expectedCountries = isAmbiguous ? ambiguousCities[cityLower] : []
          const countryLower = country ? country.toLowerCase().trim() : null
          
          transformedWebResults = transformedWebResults.filter((result) => {
            const orig = (result as { _originalSnippet?: string })._originalSnippet || ""
            const resultText = `${result.title || ""} ${result.description || ""} ${orig} ${result.externalUrl || ""}`.toLowerCase()
            
            // HARD FILTER #1: If searching from Australia, exclude ANY result mentioning US cities/states
            if (countryLower && countryLower.includes("australia")) {
              // Check for known US cities
              const mentionsUSCity = knownUSCities.some(usCity => {
                if (usCity === cityLower) return false // Don't exclude if it's the target city
                const usCityRegex = new RegExp(`\\b${usCity.replace(/\s+/g, '\\s+')}\\b`, "i")
                return usCityRegex.test(resultText)
              })
              
              if (mentionsUSCity) {
                console.log(`[v0] 🚫 EXCLUDED from /api/search/events: US city detected in "${result.title?.substring(0, 50)}" when searching from Australia`)
                return false
              }
              
              // Check for US state mentions
              const mentionsUSState = usStates.some(state => {
                const stateRegex = new RegExp(`\\b${state}\\b`, "i")
                return stateRegex.test(resultText)
              })
              
              if (mentionsUSState) {
                console.log(`[v0] 🚫 EXCLUDED from /api/search/events: US state detected in "${result.title?.substring(0, 50)}" when searching from Australia`)
                return false
              }
              
              // Check for US country indicators without Australia indicators
              const hasUSIndicators = /\b(usa|united states|us|america|u\.s\.|u\.s\.a\.)\b/i.test(resultText)
              
              if (hasUSIndicators && !hasAustraliaIndicators(resultText)) {
                console.log(`[v0] 🚫 EXCLUDED from /api/search/events: US indicators found but no Australia indicators in "${result.title?.substring(0, 50)}"`)
                return false
              }
            }
            
            // RELAXED FILTERING: Only exclude if explicitly mentions a different major city
            // Since web search already filtered by city in the query, we trust Google's relevance
            // Only filter out obvious mismatches (different cities, wrong country for ambiguous cities)
            if (isAmbiguous && countryLower) {
              // For ambiguous cities with country specified, exclude if result mentions wrong country
              const wrongCountryMatch = expectedCountries.some((expectedCountry) => {
                const expectedLower = expectedCountry.toLowerCase()
                // If we're searching for Melbourne, Australia, exclude if result mentions Florida/USA
                if (expectedLower.includes("australia") && /\b(florida|fl|usa|united states|us|america)\b/i.test(resultText)) {
                  // But allow if it also mentions Australia/Melbourne (might be a comparison or list)
                  return !hasAustraliaIndicators(resultText) || !resultText.includes(cityLower)
                }
                return false
              })
              
              if (wrongCountryMatch) {
                console.log(`[v0] 🚫 EXCLUDED: Wrong country variant for ambiguous city "${city}" in "${result.title?.substring(0, 50)}"`)
                return false
              }
            }
            
            // Allow all results that pass the negative filters above
            // Don't require city to appear in result text - web search query already filtered by city
            return true
          })
          
          if (beforeCityFilter !== transformedWebResults.length) {
            console.log(`[v0] Filtered web results by city "${city}": ${beforeCityFilter} -> ${transformedWebResults.length}`)
          }
        }

        webResults = transformedWebResults
        debugTrace.webAfterLocationCount = webResults.length
        debugTrace.sampleWebTitles = webResults.slice(0, 3).map(r => r.title || "")
        
        console.log("[v0] Web search found:", webResults.length, "events after location filtering")
      } catch (error: any) {
        debugTrace.webError = error?.message || String(error)
        console.error("[v0] Web search error:", error?.message || error)
        console.error("[v0] Web search error details:", {
          hasApiKey: !!process.env.GOOGLE_API_KEY,
          hasPseId: !!process.env.GOOGLE_PSE_ID,
          error: error?.message || String(error),
        })
        // Continue without web results
      }
    } else if (!q.trim()) {
      console.log("[v0] Skipping web search - no query provided")
    }

    // Legacy stub events (can be removed if web search is working)
    const stubExternalEvents = EXTERNAL_STUB_EVENTS.filter((event) => {
      const matchesQuery =
        event.title.toLowerCase().includes(q.toLowerCase()) ||
        event.description.toLowerCase().includes(q.toLowerCase()) ||
        event.location.city.toLowerCase().includes(q.toLowerCase())

      const matchesCity = !city || event.location.city.toLowerCase().includes(city.toLowerCase())
      const matchesCountry = !country || event.location.country.toLowerCase().includes(country.toLowerCase())

      return matchesQuery && matchesCity && matchesCountry
    })

    // Filter web results: exclude past events ONLY if date is parseable
    // CRITICAL: Don't drop web results solely because date is missing
    // Gig guides/listing pages often don't have parseable dates but are still valid event sources
    const currentYear = now.getFullYear()
    let filteredWebResults = webResults.filter((result) => {
      // Only filter by date if date is present and parseable
      if (result.startAt) {
        try {
          const eventDate = new Date(result.startAt)
          // Only exclude if date is valid AND in the past
          if (!isNaN(eventDate.getTime()) && eventDate < now) {
            return false // Exclude past events (only if date is valid)
          }
          // If date is invalid/unparseable, keep the result (gig guides often have unparseable dates)
        } catch {
          // Invalid date format - keep the result (don't drop for missing date)
        }
      }
      // Additional staleness heuristic for undated pages:
      // If title/description only mention years that are clearly in the past, drop them.
      const text = `${result.title || ""} ${result.description || ""}`.toLowerCase()
      const yearMatches = Array.from(text.matchAll(/\b(20\d{2})\b/g)).map(m => parseInt(m[1], 10))
      if (yearMatches.length > 0) {
        const maxYear = Math.max(...yearMatches)
        // Consider pages stale if their latest referenced year is more than 1 year in the past
        if (maxYear <= currentYear - 2) {
          return false
        }
      }

      // No clear staleness signal - keep the result (web fallback should be lenient)
      return true
    })
    
    debugTrace.webAfterDateCount = filteredWebResults.length
    
    // STRICT LOCATION FILTER: Apply city/country filter if specified
    // This is a second pass to ensure absolute strictness - no results from other cities/countries
    if (city) {
      const cityLower = city.toLowerCase().trim()
      const countryLower = country ? country.toLowerCase().trim() : null
      const beforeCityFilter = filteredWebResults.length
      
      // Known US cities to exclude when searching from Australia (same list as earlier)
      const knownUSCities = [
        "fort worth", "austin", "seneca", "dallas", "houston", "boston", "kansas city", "phoenix",
        "chicago", "los angeles", "new york", "san francisco", "seattle", "denver", "miami",
        "atlanta", "philadelphia", "san diego", "detroit", "minneapolis", "portland", "orlando",
        "las vegas", "nashville", "cleveland", "tampa", "sacramento", "oakland", "omaha"
      ]
      
      // US states to check
      const usStates = [
        "texas", "california", "florida", "new york", "pennsylvania", "illinois", "ohio", "georgia",
        "north carolina", "michigan", "new jersey", "virginia", "washington", "arizona", "massachusetts",
        "tennessee", "indiana", "missouri", "maryland", "wisconsin", "colorado", "minnesota", "south carolina"
      ]
      
      filteredWebResults = filteredWebResults.filter((result) => {
        const orig = (result as { _originalSnippet?: string })._originalSnippet || ""
        const resultText = `${result.title || ""} ${result.description || ""} ${orig} ${result.externalUrl || ""}`.toLowerCase()
        
        // STRICT FILTER #1: If searching from Australia, exclude ANY result mentioning US cities/states
        if (countryLower && countryLower.includes("australia")) {
          const mentionsUSCity = knownUSCities.some(usCity => {
            if (usCity === cityLower) return false // Don't exclude if it's the target city
            const usCityRegex = new RegExp(`\\b${usCity.replace(/\s+/g, '\\s+')}\\b`, "i")
            return usCityRegex.test(resultText)
          })
          
          if (mentionsUSCity) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded US city in "${result.title?.substring(0, 50)}" when searching from Australia`)
            return false
          }
          
          const mentionsUSState = usStates.some(state => {
            const stateRegex = new RegExp(`\\b${state}\\b`, "i")
            return stateRegex.test(resultText)
          })
          
          if (mentionsUSState) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded US state in "${result.title?.substring(0, 50)}" when searching from Australia`)
            return false
          }
          
          // Check for US country indicators without Australia indicators
          const hasUSIndicators = /\b(usa|united states|us|america|u\.s\.|u\.s\.a\.)\b/i.test(resultText)
          
          if (hasUSIndicators && !hasAustraliaIndicators(resultText)) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded US indicators (no Australia) in "${result.title?.substring(0, 50)}"`)
            return false
          }
        }
        
        // RELAXED FILTERING: Web search already filtered by city in the query
        // Only exclude obvious mismatches - don't require city/country in result text
        // Trust Google's search relevance since we searched for "query city events"
        
        // Only exclude if explicitly mentions a different major city AND it's clearly wrong
        const otherMajorCities = ["sydney", "brisbane", "perth", "adelaide", "canberra", "darwin",
          "new york", "los angeles", "london", "paris", "berlin", "tokyo", "toronto"]
        if (cityLower !== "melbourne" || countryLower?.includes("australia")) {
          // Only check for other cities if it's NOT about the target city at all
          const mentionsOtherCity = otherMajorCities.some(otherCity => {
            if (otherCity === cityLower) return false
            const otherCityRegex = new RegExp(`\\b${otherCity}\\b`, "i")
            const mentionsTargetCity = resultText.includes(cityLower)
            // Exclude only if mentions other city AND doesn't mention target city
            return otherCityRegex.test(resultText) && !mentionsTargetCity
          })
          
          if (mentionsOtherCity) {
            console.log(`[v0] 🚫 STRICT FILTER: Excluded result mentioning different major city in "${result.title?.substring(0, 50)}"`)
            return false
          }
        }
        
        // Allow all results - web search query already filtered by city
        return true
      })
      
      if (beforeCityFilter !== filteredWebResults.length) {
        console.log(`[v0] STRICT location filter applied: ${beforeCityFilter} → ${filteredWebResults.length} web results (city: "${city}"${country ? `, country: "${country}"` : ""})`)
      }
    }
    
    console.log(`[v0] Filtered web results (past events excluded): ${webResults.length} → ${filteredWebResults.length}`)

    // PRIORITY: Internal events (user-created, curated) ALWAYS come FIRST
    // External web results come AFTER, regardless of date or city match
    // This ensures user satisfaction with accurate, curated events
    
    // Deterministic ranking (lib/search/score-search-result): internal-first order unchanged; scores explain relevance.
    const explicitCategoryTrimmed = category?.trim()
    const rankingCategorySignal =
      explicitCategoryTrimmed && explicitCategoryTrimmed.toLowerCase() !== "all"
        ? explicitCategoryTrimmed.toLowerCase()
        : rankingCategoryFromParsedIntent(parsedIntent)

    const searchPlanForScoring =
      ambientParentExpansionApplied && effectiveCity
        ? { ...searchPlan, location: { ...searchPlan.location, city: effectiveCity } }
        : searchPlan

    const scoredInternal = events
      .map((e: any) => {
        const breakdown = scoreSearchResult({
          result: e,
          intent: parsedIntent,
          searchPlan: searchPlanForScoring,
          now,
          kind: "internal",
          rankingCategory: rankingCategorySignal,
          webListingBoost: 0,
        })
        if (!breakdown) return null
        return { ...e, _score: breakdown.total, _rankBreakdown: breakdown, _resultKind: "internal" as const }
      })
      .filter(Boolean) as any[]

    scoredInternal.sort((a: any, b: any) => {
      if ((b._score ?? 0) !== (a._score ?? 0)) return (b._score ?? 0) - (a._score ?? 0)
      const ta = new Date(a.startAt).getTime()
      const tb = new Date(b.startAt).getTime()
      if (ta !== tb) return ta - tb
      return String(a.id ?? "").localeCompare(String(b.id ?? ""))
    })

    if (debug && scoredInternal.length > 0) {
      debugTrace.rankingInternalSample = scoredInternal.slice(0, 5).map((r: any) => ({
        id: r.id,
        title: r.title?.slice(0, 80),
        breakdown: r._rankBreakdown,
      }))
    }

    const toPublicInternalRow = (row: any) => {
      const {
        _score,
        _rankBreakdown,
        _resultKind,
        _effectiveRankScore,
        _preDiversityIndex,
        _diversityHost,
        _hostOccurrenceIndex,
        ...e
      } = row
      const base = { ...e, source: "internal" as const, isEventaEvent: true }
      const devMeta =
        process.env.NODE_ENV === "development"
          ? { score: _score, scoreBreakdown: _rankBreakdown ?? null, sourceType: "internal" as const }
          : {}
      const dbg = debug && _rankBreakdown ? { _rankBreakdown } : {}
      return { ...base, ...devMeta, ...dbg }
    }

    const toPublicWebRow = (row: any) => {
      const {
        _eventnessBoost,
        _score,
        _rankBreakdown,
        _resultKind,
        _effectiveRankScore,
        _preDiversityIndex,
        _diversityHost,
        _hostOccurrenceIndex,
        _diversityPenalty,
        ...e
      } = row
      const base = { ...e, source: "web" as const, isWebResult: true }
      const devMeta =
        process.env.NODE_ENV === "development"
          ? {
              score: _score,
              scoreBreakdown: _rankBreakdown ?? null,
              sourceType: "web" as const,
              host: _diversityHost ?? null,
              hostOccurrenceIndex:
                typeof _hostOccurrenceIndex === "number" ? _hostOccurrenceIndex : null,
              diversityPenalty:
                typeof _diversityPenalty === "number" ? _diversityPenalty : null,
            }
          : {}
      const dbg = debug && _rankBreakdown ? { _rankBreakdown } : {}
      return { ...base, ...devMeta, ...dbg }
    }

    // Mark external events with source
    const externalEventsUnranked = filteredWebResults.map((e: any) => ({
      ...e,
      source: "web" as const,
      isWebResult: true,
    }))

    // EVENT-FIRST RANKING: Apply event-first ranking to web results
    // This prioritizes actual, specific events over aggregators/directories
    // Ranking only applies to event-intent queries (detected automatically)
    // Note: isEventQuery is already defined at the top of the function
    
    if (isEventQuery) {
      console.log(`[v0] 🎯 Event-intent query detected: "${q}" - applying event-first ranking to web results`)
    }
    
    // E3: Small route-level web boosts/penalties; generic listing hubs are penalised in scoreSearchResult.
    const scoredWebResults = externalEventsUnranked.map((result: any) => {
      let boost = 0
      const url = (result._originalUrl || result.externalUrl || "").toLowerCase()
      const snippet = (result._originalSnippet || result.description || "").toLowerCase()
      const fullText = `${url} ${snippet}`.toLowerCase()
      const isGov = url.includes(".gov.au") || url.includes(".gov/")

      if (isGov && /\/events?\b/i.test(url)) {
        boost += 4
      } else if (isGov) {
        boost += 2
      }

      if (!isGov && /(whats-on|whatson|what-s-on|\/events\/|event-calendar|gig-guide)/i.test(fullText)) {
        boost -= 8
      }

      if (url.includes("eventbrite.com")) {
        boost -= 3
      }
      if (url.includes("reddit.com") || url.includes("facebook.com/posts")) {
        boost -= 2
      }
      if (url.includes("/choose") || url.includes("/select-country")) {
        boost -= 3
      }

      return { ...result, _eventnessBoost: boost }
    })
    
    const scoredWebRanked = scoredWebResults
      .map((result: any) => {
        const breakdown = scoreSearchResult({
          result,
          intent: parsedIntent,
          searchPlan: searchPlanForScoring,
          now,
          kind: "web",
          rankingCategory: rankingCategorySignal,
          webListingBoost: result._eventnessBoost || 0,
        })
        if (!breakdown) return null
        return { ...result, _score: breakdown.total, _rankBreakdown: breakdown, _resultKind: "web" as const }
      })
      .filter(Boolean) as any[]

    scoredWebRanked.sort((a: any, b: any) => {
      if ((b._score ?? 0) !== (a._score ?? 0)) return (b._score ?? 0) - (a._score ?? 0)
      try {
        const ta = new Date(a.startAt).getTime()
        const tb = new Date(b.startAt).getTime()
        if (ta !== tb) return ta - tb
      } catch {
        /* ignore */
      }
      return String(a.title ?? a.externalUrl ?? "").localeCompare(String(b.title ?? b.externalUrl ?? ""))
    })

    const stubScoredWeb =
      process.env.NODE_ENV === "production"
        ? ([] as any[])
        : EXTERNAL_STUB_EVENTS.map((stub: any) => {
            const r = {
              ...stub,
              city: stub.location?.city ?? "",
              country: stub.location?.country ?? "",
              startAt:
                stub.startAt instanceof Date ? stub.startAt.toISOString() : String(stub.startAt),
              endAt: stub.endAt instanceof Date ? stub.endAt.toISOString() : String(stub.endAt),
              description: stub.description || "",
              source: "web" as const,
              isWebResult: true,
              externalUrl: stub.externalUrl,
              _originalUrl: stub.externalUrl,
              _originalSnippet: stub.description || "",
            }
            const breakdown = scoreSearchResult({
              result: r,
              intent: parsedIntent,
              searchPlan: searchPlanForScoring,
              now,
              kind: "web",
              rankingCategory: rankingCategorySignal,
              webListingBoost: 0,
            })
            if (!breakdown) return null
            return { ...r, _score: breakdown.total, _rankBreakdown: breakdown, _resultKind: "web" as const }
          }).filter(Boolean)

    let unifiedRanked = [...scoredInternal, ...scoredWebRanked, ...stubScoredWeb].sort((a: any, b: any) => {
      if ((b._score ?? 0) !== (a._score ?? 0)) return (b._score ?? 0) - (a._score ?? 0)
      try {
        const ta = new Date(a.startAt).getTime()
        const tb = new Date(b.startAt).getTime()
        if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb
      } catch {
        /* ignore */
      }
      const sa = a._resultKind === "internal" ? 0 : 1
      const sb = b._resultKind === "internal" ? 0 : 1
      if (sa !== sb) return sa - sb
      return String(a.id ?? a.externalUrl ?? "").localeCompare(String(b.id ?? b.externalUrl ?? ""))
    })

    const applyBroadHostDiversity =
      searchPlanForScoring.scope === "broad" && !rankingCategorySignal

    if (applyBroadHostDiversity && unifiedRanked.length > 1) {
      unifiedRanked = applyBroadWebHostDiversity(unifiedRanked) as any[]
    }

    const eventsPublic = unifiedRanked.map((row: any) =>
      row._resultKind === "internal" ? toPublicInternalRow(row) : toPublicWebRow(row),
    )

    const internalEvents = eventsPublic.filter((e: any) => e.source === "internal")
    const externalEvents = eventsPublic.filter((e: any) => e.source === "web")

    debugTrace.webAfterEventinessCount = scoredWebRanked.length

    if (debug && scoredWebRanked.length > 0) {
      debugTrace.rankingWebSample = scoredWebRanked.slice(0, 5).map((r: any) => ({
        title: r.title?.slice(0, 80),
        breakdown: r._rankBreakdown,
      }))
    }

    if (isEventQuery && scoredWebRanked.length > 0) {
      console.log(`[v0] ✅ Deterministic ranking applied to ${scoredWebRanked.length} web results`)
    }

    debugTrace.finalReturnedInternalCount = internalEvents.length
    debugTrace.finalReturnedWebCount = externalEvents.length

    const isEmptyState = isEventQuery && events.length === 0 && scoredWebRanked.length === 0 && stubScoredWeb.length === 0

    if (isEmptyState) {
      console.log(`[v0] 📭 Empty state: event-intent query with no internal events and no web events found (after strict location filtering)`)
    } else if (isEventQuery && events.length === 0 && scoredWebRanked.length > 0) {
      console.log(`[v0] ✅ Web fallback successful: ${scoredWebRanked.length} local web events found for event-intent query`)
    }

    const stripLegacyPrivateFields = (e: any) => {
      const { _eventnessBoost, _score, _rankBreakdown, _resultKind, ...rest } = e
      return rest
    }

    const response: any = {
      events: eventsPublic.map(stripLegacyPrivateFields),
      count: eventsPublic.length,
      page,
      take,
      query: q,
      internal: internalEvents.map(stripLegacyPrivateFields),
      external: externalEvents.map(stripLegacyPrivateFields),
      total: eventsPublic.length,
      // Empty state flag: true only if both internal and web events are 0
      emptyState: isEmptyState,
      // Indicate if web results were included (for UI labeling)
      includesWeb: externalEvents.length > 0,
      // Indicate if this is an event-intent query
      isEventIntent: isEventQuery,
      // Locality Contract F: Return effectiveLocation for UI labeling
      effectiveLocation: effectiveLocation,
      phase1Interpretation,
    }
    
    // Add debug trace if ?debug=1
    if (debug) {
      response.debugTrace = debugTrace
    }

    emitSearchEventsComplete({
      internalCount: internalEvents.length,
      externalCount: externalEvents.length,
      totalReturned: eventsPublic.length,
      includesWeb: externalEvents.length > 0,
      webCalled: debugTrace.webCalled,
      emptyState: isEmptyState,
      isEventIntent: isEventQuery,
    })

    return NextResponse.json(response)
  } catch (e: any) {
    emitSearchEventsError(e)
    const errorMessage = e?.message || String(e)
    const errorStack = e?.stack
    console.error("[v0] search/events error:", errorMessage)
    if (errorStack) {
      console.error("[v0] search/events error stack:", errorStack.substring(0, 500)) // Limit stack trace length
    }
    
    // Check for database/Prisma errors
    if (errorMessage.includes("column") || errorMessage.includes("does not exist") || errorMessage.includes("prisma") || errorMessage.includes("database")) {
      console.error("[v0] ⚠️ Database schema error detected - this might be a migration issue")
      console.error("[v0] Error details:", {
        message: errorMessage,
        query: q,
        city,
        country,
      })
    }
    
    // Return error response with details in development
    return NextResponse.json(
      {
        events: [],
        count: 0,
        internal: [],
        external: [],
        total: 0,
        emptyState: false,
        includesWeb: false,
        isEventIntent: false,
        error: process.env.NODE_ENV === "development" ? errorMessage : "Search failed",
        ...(process.env.NODE_ENV === "development" && { errorDetails: errorStack?.substring(0, 500) }),
      },
      { status: 500 },
    )
  }
}
