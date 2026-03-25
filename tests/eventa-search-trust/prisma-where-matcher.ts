export type FixtureInternalEvent = {
  id: string
  title: string
  description: string
  city: string
  country: string
  parentCity?: string | null
  region?: string | null
  venueName?: string | null
  externalUrl?: string | null
  startAt: string | Date
  endAt: string | Date
  categories?: string[] | null
  category?: string | null
}

function toLower(value: unknown): string {
  return String(value ?? "").toLowerCase()
}

function containsInsensitive(haystack: unknown, needle: string): boolean {
  const h = toLower(haystack)
  const n = toLower(needle)
  if (!n) return true
  return h.includes(n)
}

function isContainsObj(v: any): v is { contains: string; mode?: string } {
  return v && typeof v === "object" && typeof v.contains === "string"
}

function getEventField(event: FixtureInternalEvent, key: string): unknown {
  switch (key) {
    case "title":
      return event.title
    case "description":
      return event.description
    case "venueName":
      return event.venueName ?? null
    case "city":
      return event.city
    case "country":
      return event.country
    case "parentCity":
      return event.parentCity ?? null
    case "region":
      return event.region ?? null
    case "externalUrl":
      return event.externalUrl ?? null
    default:
      return undefined
  }
}

function matchesCategoryCondition(event: FixtureInternalEvent, expectedCategory: string): boolean {
  const enumNeedle = toLower(expectedCategory)
  if (event.category && toLower(event.category) === enumNeedle) return true

  const cats = event.categories ?? []
  return cats.some((c) => toLower(c) === enumNeedle)
}

function matchesCategoriesHasSomeCondition(event: FixtureInternalEvent, hasSome: unknown): boolean {
  const list = Array.isArray(hasSome) ? hasSome.map((v) => String(v)) : []
  if (list.length === 0) return true

  const cats = event.categories ?? []
  const categoryField = event.category ?? null

  const needles = list.map((s) => toLower(s))
  const hasCategoryEnum = categoryField ? needles.includes(toLower(categoryField)) : false
  const hasInCategories =
    cats.some((c) => {
      const cl = toLower(c)
      return needles.includes(cl)
    }) || false

  return hasCategoryEnum || hasInCategories
}

function matchesAtomicCondition(event: FixtureInternalEvent, key: string, expected: any): boolean {
  if (key === "category") {
    return typeof expected === "string" ? matchesCategoryCondition(event, expected) : true
  }

  if (key === "categories") {
    const hasSome = expected?.hasSome
    return matchesCategoriesHasSomeCondition(event, hasSome)
  }

  const fieldValue = getEventField(event, key)
  if (isContainsObj(expected)) {
    return containsInsensitive(fieldValue, expected.contains)
  }

  // For any unsupported condition shape, be permissive.
  return true
}

function matchesCondition(event: FixtureInternalEvent, cond: any): boolean {
  if (!cond || typeof cond !== "object") return true

  if (Array.isArray(cond.OR)) {
    return cond.OR.some((c: any) => matchesCondition(event, c))
  }

  if (Array.isArray(cond.AND)) {
    return cond.AND.every((c: any) => matchesCondition(event, c))
  }

  const knownKeys = [
    "title",
    "description",
    "venueName",
    "city",
    "country",
    "parentCity",
    "region",
    "externalUrl",
    "category",
    "categories",
  ]
  const keysInCond = knownKeys.filter((k) => Object.prototype.hasOwnProperty.call(cond, k))

  // If it's not one of our supported primitives, don't block matching.
  if (keysInCond.length === 0) return true

  return keysInCond.every((key) => matchesAtomicCondition(event, key, cond[key]))
}

/**
 * Minimal Prisma-where interpreter for Eventa route regression tests.
 *
 * Supports only the subset used by `app/api/search/events/route.ts`:
 * - date overlap: where.startAt.lte / where.endAt.gte
 * - location: where.country.contains and city/title/description contains inside where.AND.{OR:[...]}
 * - text: title/description/venueName/city/country contains inside where.AND.{OR:[...]}
 * - category: where.AND.{OR:[{category: enum},{categories: {hasSome:[...]}}]}
 */
export function matchesPrismaWhere(event: FixtureInternalEvent, where: any): boolean {
  const eventStart = new Date(event.startAt)
  const eventEnd = new Date(event.endAt)
  if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return false

  if (where?.startAt?.lte) {
    const lte = new Date(where.startAt.lte)
    if (eventStart.getTime() > lte.getTime()) return false
  }

  if (where?.endAt?.gte) {
    const gte = new Date(where.endAt.gte)
    if (eventEnd.getTime() < gte.getTime()) return false
  }

  if (where?.country && isContainsObj(where.country)) {
    if (!containsInsensitive(event.country, where.country.contains)) return false
  }

  if (Array.isArray(where?.AND)) {
    for (const cond of where.AND) {
      if (!matchesCondition(event, cond)) return false
    }
  }

  return true
}

export function deepIncludesString(value: any, needle: string): boolean {
  const n = toLower(needle)

  const seen = new Set<any>()
  const walk = (v: any): boolean => {
    if (v === null || v === undefined) return false
    if (typeof v === "string") return toLower(v).includes(n)
    if (typeof v !== "object") return false
    if (seen.has(v)) return false
    seen.add(v)

    if (Array.isArray(v)) return v.some(walk)

    return Object.values(v).some(walk)
  }

  return walk(value)
}

