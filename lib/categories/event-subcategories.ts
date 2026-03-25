import type { EventCategory } from "@prisma/client"
import { CANONICAL_EVENT_CATEGORY_VALUES } from "@/lib/categories/canonical-event-category"

/**
 * Closed vocabulary for deterministic sub-category hints (Phase 2 search).
 * IDs are stable snake_case; `key` aligns with suggested `Event.subcategory` / `categories[]` values.
 */
export const EVENT_SUBCATEGORY_DEFINITIONS = [
  { id: "music_live", parent: "MUSIC" as const, key: "live" },
  { id: "music_dj_electronic", parent: "MUSIC" as const, key: "dj_electronic" },
  { id: "music_classical_jazz", parent: "MUSIC" as const, key: "classical_jazz" },
  { id: "music_open_mic", parent: "MUSIC" as const, key: "open_mic" },

  { id: "theatre_musical", parent: "THEATRE" as const, key: "musical" },
  { id: "theatre_play", parent: "THEATRE" as const, key: "play" },
  { id: "theatre_dance_performance", parent: "THEATRE" as const, key: "dance_performance" },
  { id: "theatre_opera", parent: "THEATRE" as const, key: "opera" },

  { id: "comedy_standup", parent: "COMEDY" as const, key: "standup" },
  { id: "comedy_improv", parent: "COMEDY" as const, key: "improv" },
  { id: "comedy_sketch", parent: "COMEDY" as const, key: "sketch" },

  { id: "art_gallery", parent: "ART" as const, key: "gallery" },
  { id: "art_exhibition", parent: "ART" as const, key: "exhibition" },
  { id: "art_museum", parent: "ART" as const, key: "museum" },
  { id: "art_open_studio", parent: "ART" as const, key: "open_studio" },

  { id: "markets_farmers", parent: "MARKETS" as const, key: "farmers" },
  { id: "markets_craft_vintage", parent: "MARKETS" as const, key: "craft_vintage" },
  { id: "markets_night_market", parent: "MARKETS" as const, key: "night_market" },

  { id: "sports_running", parent: "SPORTS" as const, key: "running" },
  { id: "sports_tri_fitness", parent: "SPORTS" as const, key: "tri_fitness" },
  { id: "sports_team_ball", parent: "SPORTS" as const, key: "team_ball" },
  { id: "sports_extreme", parent: "SPORTS" as const, key: "extreme" },

  { id: "food_drink_restaurant", parent: "FOOD_DRINK" as const, key: "restaurant" },
  { id: "food_drink_wine_beer", parent: "FOOD_DRINK" as const, key: "wine_beer" },
  { id: "food_drink_food_festival", parent: "FOOD_DRINK" as const, key: "food_festival" },

  { id: "family_kids_show", parent: "FAMILY" as const, key: "kids_show" },
  { id: "family_activities", parent: "FAMILY" as const, key: "activities" },
  { id: "family_education", parent: "FAMILY" as const, key: "education" },

  { id: "film_cinema", parent: "FILM" as const, key: "cinema" },
  { id: "film_outdoor_film", parent: "FILM" as const, key: "outdoor_film" },
  { id: "film_festival_screenings", parent: "FILM" as const, key: "festival_screenings" },

  { id: "nightlife_club", parent: "NIGHTLIFE" as const, key: "club" },
  { id: "nightlife_bar_social", parent: "NIGHTLIFE" as const, key: "bar_social" },

  { id: "wellness_yoga_pilates", parent: "WELLNESS" as const, key: "yoga_pilates" },
  { id: "wellness_meditation", parent: "WELLNESS" as const, key: "meditation" },
  { id: "wellness_fitness_class", parent: "WELLNESS" as const, key: "fitness_class" },

  { id: "festivals_music_festival", parent: "FESTIVALS" as const, key: "music_festival" },
  { id: "festivals_cultural_festival", parent: "FESTIVALS" as const, key: "cultural_festival" },
  { id: "festivals_community_fair", parent: "FESTIVALS" as const, key: "community_fair" },

  { id: "talks_talk", parent: "TALKS" as const, key: "talk" },
  { id: "talks_panel", parent: "TALKS" as const, key: "panel" },
  { id: "talks_networking", parent: "TALKS" as const, key: "networking" },

  { id: "community_volunteer", parent: "COMMUNITY" as const, key: "volunteer" },
  { id: "community_meetup", parent: "COMMUNITY" as const, key: "meetup" },
  { id: "community_cultural", parent: "COMMUNITY" as const, key: "cultural" },

  { id: "workshops_creative", parent: "WORKSHOPS" as const, key: "creative" },
  { id: "workshops_professional", parent: "WORKSHOPS" as const, key: "professional" },
  { id: "workshops_kids_workshop", parent: "WORKSHOPS" as const, key: "kids_workshop" },
] as const

export type EventSubcategoryHintId = (typeof EVENT_SUBCATEGORY_DEFINITIONS)[number]["id"]

const DEF_BY_ID = new Map<string, { parent: EventCategory; key: string }>(
  EVENT_SUBCATEGORY_DEFINITIONS.map((d) => [d.id, { parent: d.parent, key: d.key }]),
)

export function getSubcategoryHintDefinition(
  id: string,
): { parent: EventCategory; key: string } | undefined {
  return DEF_BY_ID.get(id)
}

/** Valid hint IDs per Prisma category (for validation / future UI). */
export const SUBCATEGORY_IDS_BY_PARENT: Record<EventCategory, readonly string[]> = (() => {
  const acc = {} as Record<EventCategory, string[]>
  for (const c of CANONICAL_EVENT_CATEGORY_VALUES) {
    acc[c] = []
  }
  for (const d of EVENT_SUBCATEGORY_DEFINITIONS) {
    acc[d.parent].push(d.id)
  }
  return acc as Record<EventCategory, readonly string[]>
})()
