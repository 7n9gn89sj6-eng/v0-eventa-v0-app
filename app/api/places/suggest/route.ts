import { NextRequest, NextResponse } from "next/server"
import { mapboxPlacesForwardSuggest } from "@/lib/places/mapbox-places-fetch"
import { mapFeaturesToSuggestions } from "@/lib/places/place-api-mapbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function runSuggest(q: string): Promise<NextResponse> {
  const features = await mapboxPlacesForwardSuggest(q, { limit: 10 })
  return NextResponse.json({ suggestions: mapFeaturesToSuggestions(features) })
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
