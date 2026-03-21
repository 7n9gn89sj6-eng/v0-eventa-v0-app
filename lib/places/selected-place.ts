import { z } from "zod"

/**
 * Stable wire shape for resolved places (API + clients). Coordinates optional when provider
 * cannot return a point (rare for Mapbox features with center).
 */
export type SelectedPlaceWire = {
  provider: "mapbox" | string
  placeId?: string | null
  formattedAddress: string
  city: string
  country: string
  region?: string | null
  parentCity?: string | null
  lat?: number | null
  lng?: number | null
  venueName?: string | null
}

/** Verified selection from Mapbox (strict: coordinates required for submit verify-then-select). */
export const selectedMapboxPlaceSchema = z.object({
  provider: z.literal("mapbox"),
  placeId: z.string().min(1),
  formattedAddress: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  region: z.string().nullable(),
  parentCity: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  venueName: z.string().nullable().optional(),
})

export type SelectedMapboxPlace = z.infer<typeof selectedMapboxPlaceSchema>
