import { NextRequest, NextResponse } from "next/server"
import type { MapboxFeature } from "@/lib/geocoding"
import { mapMapboxFeatureToSelectedPlace } from "@/lib/places/mapbox-feature-to-wire"
import { mapboxPlacesRetrieveById } from "@/lib/places/mapbox-places-fetch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeFeaturePayload(raw: unknown): MapboxFeature | null {
  if (!raw || typeof raw !== "object") return null
  const f = raw as Record<string, unknown>
  if (typeof f.id !== "string" || typeof f.place_name !== "string" || !Array.isArray(f.place_type)) {
    return null
  }
  const centerRaw = f.center
  let center: [number, number] = [Number.NaN, Number.NaN]
  if (Array.isArray(centerRaw) && centerRaw.length >= 2) {
    const lo = centerRaw[0]
    const la = centerRaw[1]
    if (typeof lo === "number" && typeof la === "number") {
      center = [lo, la]
    }
  }
  return {
    id: f.id,
    type: typeof f.type === "string" ? f.type : "Feature",
    place_type: f.place_type as string[],
    text: typeof f.text === "string" ? f.text : f.place_name,
    place_name: f.place_name,
    center,
    context: Array.isArray(f.context) ? (f.context as MapboxFeature["context"]) : undefined,
  }
}

function respondWithPlace(feature: MapboxFeature): NextResponse {
  const place = mapMapboxFeatureToSelectedPlace(feature)
  const hasCore =
    Boolean(place.formattedAddress?.trim()) &&
    Boolean(place.placeId?.trim()) &&
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng)
  if (!hasCore) {
    return NextResponse.json({ place: null, error: "Could not structure this place." }, { status: 404 })
  }
  return NextResponse.json({ place })
}

async function runResolve(mapboxId: string): Promise<NextResponse> {
  const id = mapboxId.trim()
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const feature = await mapboxPlacesRetrieveById(id)
  if (!feature) {
    return NextResponse.json({ place: null, error: "Place not found" }, { status: 404 })
  }
  return respondWithPlace(feature)
}

/** GET /api/places/resolve?id= */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? ""
  return runResolve(id)
}

/**
 * POST { id?: string, mapboxId?: string } or POST { feature: MapboxFeature-like }
 * for resolving without a round-trip retrieve.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (body?.feature) {
    const feature = normalizeFeaturePayload(body.feature)
    if (!feature) {
      return NextResponse.json({ error: "Invalid feature payload" }, { status: 400 })
    }
    return respondWithPlace(feature)
  }
  const mapboxId =
    (typeof body.mapboxId === "string" ? body.mapboxId : "") ||
    (typeof body.id === "string" ? body.id : "")
  return runResolve(mapboxId)
}
