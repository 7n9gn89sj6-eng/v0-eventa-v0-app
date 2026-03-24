import { z } from "zod"

/**
 * Canonical event taxonomy (Prisma `EventCategory`). Internal keys stay English;
 * UI labels live in `CATEGORY_UI_METADATA` for future i18n.
 */
export const CANONICAL_EVENT_CATEGORY_VALUES = [
  "MUSIC",
  "THEATRE",
  "COMEDY",
  "ART",
  "FILM",
  "FOOD_DRINK",
  "FAMILY",
  "COMMUNITY",
  "MARKETS",
  "NIGHTLIFE",
  "WORKSHOPS",
  "SPORTS",
  "WELLNESS",
  "FESTIVALS",
  "TALKS",
  "OTHER",
] as const

export type CanonicalEventCategory = (typeof CANONICAL_EVENT_CATEGORY_VALUES)[number]

const CATEGORY_SET = new Set<string>(CANONICAL_EVENT_CATEGORY_VALUES)

export const CATEGORY_UI_METADATA: Record<
  CanonicalEventCategory,
  { defaultLabel: string; /** future: i18n key */ translationKey?: string }
> = {
  MUSIC: { defaultLabel: "Music", translationKey: "eventCategory.music" },
  THEATRE: { defaultLabel: "Theatre", translationKey: "eventCategory.theatre" },
  COMEDY: { defaultLabel: "Comedy", translationKey: "eventCategory.comedy" },
  ART: { defaultLabel: "Art", translationKey: "eventCategory.art" },
  FILM: { defaultLabel: "Film", translationKey: "eventCategory.film" },
  FOOD_DRINK: { defaultLabel: "Food & drink", translationKey: "eventCategory.foodDrink" },
  FAMILY: { defaultLabel: "Family", translationKey: "eventCategory.family" },
  COMMUNITY: { defaultLabel: "Community", translationKey: "eventCategory.community" },
  MARKETS: { defaultLabel: "Markets", translationKey: "eventCategory.markets" },
  NIGHTLIFE: { defaultLabel: "Nightlife", translationKey: "eventCategory.nightlife" },
  WORKSHOPS: { defaultLabel: "Workshops", translationKey: "eventCategory.workshops" },
  SPORTS: { defaultLabel: "Sports", translationKey: "eventCategory.sports" },
  WELLNESS: { defaultLabel: "Wellness", translationKey: "eventCategory.wellness" },
  FESTIVALS: { defaultLabel: "Festivals", translationKey: "eventCategory.festivals" },
  TALKS: { defaultLabel: "Talks", translationKey: "eventCategory.talks" },
  OTHER: { defaultLabel: "Other", translationKey: "eventCategory.other" },
}

/** Primary search / filter slug stored in `Event.categories` for backward-compatible text filters. */
export const SEARCH_SLUG_BY_CATEGORY: Record<CanonicalEventCategory, string> = {
  MUSIC: "music",
  THEATRE: "theatre",
  COMEDY: "comedy",
  ART: "art",
  FILM: "film",
  FOOD_DRINK: "food",
  FAMILY: "family",
  COMMUNITY: "community",
  MARKETS: "markets",
  NIGHTLIFE: "nightlife",
  WORKSHOPS: "workshops",
  SPORTS: "sports",
  WELLNESS: "wellness",
  FESTIVALS: "festivals",
  TALKS: "talks",
  OTHER: "other",
}

/** Map URL / intent slugs (lowercase) → canonical enum. */
export const SEARCH_SLUG_TO_CANONICAL: Record<string, CanonicalEventCategory> = {
  music: "MUSIC",
  markets: "MARKETS",
  arts: "ART",
  art: "ART",
  food: "FOOD_DRINK",
  drink: "FOOD_DRINK",
  sports: "SPORTS",
  sport: "SPORTS",
  family: "FAMILY",
  kids: "FAMILY",
  community: "COMMUNITY",
  learning: "TALKS",
  talks: "TALKS",
  talk: "TALKS",
  comedy: "COMEDY",
  festival: "FESTIVALS",
  festivals: "FESTIVALS",
  theatre: "THEATRE",
  theater: "THEATRE",
  film: "FILM",
  movies: "FILM",
  cinema: "FILM",
  nightlife: "NIGHTLIFE",
  club: "NIGHTLIFE",
  workshops: "WORKSHOPS",
  workshop: "WORKSHOPS",
  wellness: "WELLNESS",
  yoga: "WELLNESS",
  online: "TALKS",
  virtual: "TALKS",
  other: "OTHER",
}

/** Legacy extraction / API strings (broad categories). Kept for AI + create-simple compatibility. */
const LEGACY_BROAD_TO_CANONICAL: Record<string, CanonicalEventCategory> = {
  arts_culture: "ART",
  music_nightlife: "MUSIC",
  food_drink: "FOOD_DRINK",
  family_kids: "FAMILY",
  sports_outdoors: "SPORTS",
  community_causes: "COMMUNITY",
  learning_talks: "TALKS",
  markets_fairs: "MARKETS",
  // Still maps to TALKS so callers are not forced into OTHER+customLabel; DB migration maps old ONLINE_VIRTUAL -> OTHER.
  online_virtual: "TALKS",
}

/** Legacy Prisma enum strings still accepted in payloads. */
const LEGACY_PRISMA_TO_CANONICAL: Record<string, CanonicalEventCategory> = {
  ARTS_CULTURE: "ART",
  MUSIC_NIGHTLIFE: "MUSIC",
  FOOD_DRINK: "FOOD_DRINK",
  FAMILY_KIDS: "FAMILY",
  SPORTS_OUTDOORS: "SPORTS",
  COMMUNITY_CAUSES: "COMMUNITY",
  LEARNING_TALKS: "TALKS",
  MARKETS_FAIRS: "MARKETS",
  ONLINE_VIRTUAL: "TALKS",
}

export function isCanonicalEventCategory(v: string): v is CanonicalEventCategory {
  return CATEGORY_SET.has(v)
}

/**
 * Accepts canonical enum, legacy Prisma enum, legacy extraction strings, or search slugs.
 */
/** Resolve URL/query category tokens to Prisma enum (same string values as `CanonicalEventCategory`). */
export function resolveUrlCategoryToPrismaEnum(raw: string | null | undefined): CanonicalEventCategory | null {
  if (raw == null || !String(raw).trim()) return null
  return coerceToCanonicalEventCategory(raw)
}

export function coerceToCanonicalEventCategory(input: string | null | undefined): CanonicalEventCategory | null {
  if (input == null) return null
  const raw = String(input).trim()
  if (!raw) return null

  const upper = raw.toUpperCase().replace(/-/g, "_")
  if (isCanonicalEventCategory(upper)) return upper

  const legacyP = LEGACY_PRISMA_TO_CANONICAL[upper]
  if (legacyP) return legacyP

  const norm = raw.toLowerCase().replace(/\s+/g, "_")
  const broad = LEGACY_BROAD_TO_CANONICAL[norm]
  if (broad) return broad

  const slug = raw.toLowerCase()
  return SEARCH_SLUG_TO_CANONICAL[slug] ?? null
}

function trimToNull(s: string | undefined | null, maxLen: number): string | null {
  if (s == null) return null
  const t = s.trim()
  if (!t) return null
  return t.length > maxLen ? t.slice(0, maxLen) : t
}

export function normalizeOptionalSubcategory(raw: string | undefined | null): string | null {
  return trimToNull(raw ?? null, 120)
}

export function normalizeOptionalTags(raw: string[] | undefined | null): string[] {
  if (!raw?.length) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    const t = String(x).trim()
    if (!t) continue
    const clipped = t.length > 60 ? t.slice(0, 60) : t
    const key = clipped.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clipped)
    if (out.length >= 30) break
  }
  return out
}

export const eventCategoryPayloadSchema = z
  .object({
    category: z.string().min(1),
    subcategory: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    customCategoryLabel: z.string().nullable().optional(),
    originalLanguage: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const canonical = coerceToCanonicalEventCategory(data.category)
    if (!canonical) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid event category", path: ["category"] })
      return
    }

    const label = trimToNull(data.customCategoryLabel ?? null, 40)
    if (canonical === "OTHER") {
      if (!label) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Describe the event type is required when category is Other",
          path: ["customCategoryLabel"],
        })
      }
    } else if (label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom type is only allowed when category is Other",
        path: ["customCategoryLabel"],
      })
    }

  })

export type ParsedEventCategoryPayload = {
  category: CanonicalEventCategory
  subcategory: string | null
  tags: string[]
  customCategoryLabel: string | null
  originalLanguage: string | null
}

export function parseEventCategoryPayload(data: z.input<typeof eventCategoryPayloadSchema>): ParsedEventCategoryPayload {
  const parsed = eventCategoryPayloadSchema.parse(data)
  const category = coerceToCanonicalEventCategory(parsed.category)!
  return {
    category,
    subcategory: normalizeOptionalSubcategory(parsed.subcategory ?? null),
    tags: normalizeOptionalTags(parsed.tags ?? null),
    customCategoryLabel: category === "OTHER" ? trimToNull(parsed.customCategoryLabel ?? null, 40) : null,
    originalLanguage: trimToNull(parsed.originalLanguage ?? null, 16),
  }
}
