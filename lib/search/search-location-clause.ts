import { EXECUTION_CITY_VARIATIONS, STRICT_INTERNAL_CITY_VARIANTS } from "@/lib/search/city-variations"

export type CityLocationClauseMode = "explicit_query" | "inclusive"

/**
 * Prisma AND-branch: match execution city against structured `city` / `parentCity`, optionally title/description.
 * - explicit_query: locality-first for typed/query places — `event.city` only (+ variants), no parentCity / text fallback.
 * - inclusive: UI / parent-metro — `city` OR `parentCity` (+ variants), then title/description as weaker fallback.
 */
export function buildStructuredCityLocationOrClause(
  executionCity: string,
  mode: CityLocationClauseMode,
): { OR: Record<string, unknown>[] } {
  const cityLower = executionCity.toLowerCase().trim()
  const variations = EXECUTION_CITY_VARIATIONS[cityLower] || []
  const allCityNames = [cityLower, ...variations]

  const or: Record<string, unknown>[] = []
  for (const name of allCityNames) {
    or.push({ city: { contains: name, mode: "insensitive" as const } })
  }

  if (mode === "inclusive") {
    for (const name of allCityNames) {
      or.push({ parentCity: { contains: name, mode: "insensitive" as const } })
    }
    or.push(
      { title: { contains: cityLower, mode: "insensitive" as const } },
      { description: { contains: cityLower, mode: "insensitive" as const } },
    )
  }

  return { OR: or }
}

const CITY_LOCATION_OR_KEYS = new Set(["city", "parentCity", "title", "description"])

export function isPrismaCityLocationOrClause(clause: any): boolean {
  if (!clause?.OR || !Array.isArray(clause.OR)) return false
  return clause.OR.every((o: any) => {
    const keys = Object.keys(o || {})
    if (keys.length !== 1) return false
    return CITY_LOCATION_OR_KEYS.has(keys[0])
  })
}

export function replaceExecutionCityInWhere(whereRoot: any, newCity: string): boolean {
  const and = whereRoot?.AND
  if (!Array.isArray(and)) return false
  const idx = and.findIndex((c: any) => isPrismaCityLocationOrClause(c))
  if (idx < 0) return false
  and[idx] = buildStructuredCityLocationOrClause(newCity, "inclusive")
  return true
}

export function applyStrictInternalCityFilter(
  eventsIn: any[],
  cityName: string | null,
  opts?: { allowParentCityMatch?: boolean },
): { events: any[]; count: number } {
  if (!cityName) return { events: eventsIn, count: eventsIn.length }
  const cityLower = cityName.toLowerCase().trim()
  const variants = [cityLower, ...(STRICT_INTERNAL_CITY_VARIANTS[cityLower] || [])].map((v) => v.toLowerCase())
  const allowParent = Boolean(opts?.allowParentCityMatch)

  const hasAnyNonEmptyCityField = eventsIn.some((e: any) => String(e?.city || "").trim().length > 0)
  if (!hasAnyNonEmptyCityField) {
    return { events: eventsIn, count: eventsIn.length }
  }

  const strictMatched = eventsIn.filter((e: any) => {
    const eventCity = String(e?.city || "").toLowerCase()
    const eventParent = String(e?.parentCity || "").toLowerCase()
    const cityHit = eventCity && variants.some((v) => eventCity.includes(v))
    const parentHit =
      allowParent &&
      eventParent &&
      variants.some((v) => eventParent.includes(v))
    if (cityHit || parentHit) return true
    return false
  })

  if (strictMatched.length !== eventsIn.length) {
    console.log(
      `[v0] 🔒 Strict internal city filtering: ${eventsIn.length} -> ${strictMatched.length} for city="${cityLower}".`,
    )
  }
  return { events: strictMatched, count: strictMatched.length }
}
