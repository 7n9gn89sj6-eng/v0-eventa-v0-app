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

export type BroadEventCategory =
  | "arts_culture"
  | "music_nightlife"
  | "food_drink"
  | "family_kids"
  | "sports_outdoors"
  | "community_causes"
  | "learning_talks"
  | "markets_fairs"
  | "online_virtual"

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

export interface EventExtractionInput {
  source_text: string
  image_meta?: string
  link?: string
  contact?: string
}

export interface LocationExtraction {
  name: string | null
  address: string | null
  lat: number | null
  lng: number | null
}

export interface ExtractionConfidence {
  datetime: number // 0..1
  location: number // 0..1
  title: number // 0..1
  category: number // 0..1
}

export interface EventExtractionOutput {
  title: string
  start: string // ISO8601
  end: string | null // ISO8601
  timezone: string | null // IANA
  location: LocationExtraction
  description: string
  price: "free" | "donation" | "paid" | null
  organizer_name: string | null
  organizer_contact: string | null
  category: BroadEventCategory | "auto"
  tags: string[] // max 5
  confidence: ExtractionConfidence
  notes_for_user: string[] // short clarifications
}
