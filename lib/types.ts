export type SupportedLanguage = "en" | "it" | "el" | "es" | "fr"

export type EventCategory =
  | "market"
  | "food"
  | "music"
  | "festival"
  | "culture"
  | "art"
  | "exhibition"
  | "workshop"
  | "outdoor"
  | "traditional"
  | "shopping"
  | "wine"
  | "craft"
  | "cooking"
  | "free"

export type SearchSource = "eventa" | "web"

export interface SearchResult {
  source: SearchSource
  id?: string // Only for Eventa results
  title: string
  startAt: string
  endAt?: string
  venue?: string
  address?: string
  lat?: number
  lng?: number
  url?: string
  snippet?: string
  distanceKm?: number
  categories?: string[]
  priceFree?: boolean
  imageUrl?: string
}

export interface SearchResponse {
  results: SearchResult[]
  usedWeb: boolean
  langDetected: SupportedLanguage
  totalResults: number
}

export interface SearchFilters {
  dateRange?: "today" | "weekend" | "month" | "all"
  categories?: EventCategory[]
  free?: boolean
  radiusKm?: number
  lat?: number
  lng?: number
}
