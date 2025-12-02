import type { BroadEventCategory } from "./types"

export const CATEGORY_LABELS: Record<BroadEventCategory, string> = {
  arts_culture: "Arts & Culture",
  music_nightlife: "Music & Nightlife",
  food_drink: "Food & Drink",
  family_kids: "Family & Kids",
  sports_outdoors: "Sports & Outdoors",
  community_causes: "Community & Causes",
  learning_talks: "Learning & Talks",
  markets_fairs: "Markets & Fairs",
  online_virtual: "Online & Virtual",
}

export function categoryToEnum(category: string): BroadEventCategory | null {
  const map: Record<string, BroadEventCategory> = {
    arts_culture: "arts_culture",
    music_nightlife: "music_nightlife",
    food_drink: "food_drink",
    family_kids: "family_kids",
    sports_outdoors: "sports_outdoors",
    community_causes: "community_causes",
    learning_talks: "learning_talks",
    markets_fairs: "markets_fairs",
    online_virtual: "online_virtual",
  }

  return map[category] || null
}
