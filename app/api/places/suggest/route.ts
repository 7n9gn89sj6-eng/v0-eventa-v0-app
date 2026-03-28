import { NextRequest, NextResponse } from "next/server"
import { mapboxPlacesForwardSuggest } from "@/lib/places/mapbox-places-fetch"
import { mapFeaturesToSuggestions } from "@/lib/places/place-api-mapbox"
import { sortMapboxSuggestFeatures } from "@/lib/places/mapbox-suggest-helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Flow (browser → server → Mapbox):
 * - GET /api/places/suggest?q={raw} — q is the search box string, URL-encoded.
 * - Server calls Mapbox GET permanent forward geocode with autocomplete=true, limit=10, types from
 *   {@link mapboxPlacesForwardSuggest} (address-only when q has a leading street number).
 * - Features are reordered with {@link sortMapboxSuggestFeatures} so numbered queries prefer matches
 *   that include the street number in text/place_name.
 * - UI lists `suggestions[].primary` (bold) + `suggestions[].label` (kind + Mapbox `text`).
 * - On pick: GET /api/places/resolve?id={Mapbox feature id} — no body; returns the same feature by id.
 */
async function runSuggest(q: string): Promise<NextResponse> {
  const features = await mapboxPlacesForwardSuggest(q, { limit: 10 })
  const ordered = sortMapboxSuggestFeatures(q, features)
  return NextResponse.json({ suggestions: mapFeaturesToSuggestions(ordered) })
}

/** GET /api/places/suggest?q= */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? ""
  return runSuggest(q)
}

/** POST { q: string } */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const q = typeof body.q === "string" ? body.q : ""
  return runSuggest(q)
}
