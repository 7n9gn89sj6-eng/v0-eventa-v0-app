import { type NextRequest, NextResponse } from "next/server"
import { geocodeAddress, GeocodingConfigError } from "@/lib/geocoding"

/**
 * Forward geocode: city/address query -> lat, lng, city, country.
 * Used for "Enter city" manual location.
 * - 503 + code SERVICE_UNAVAILABLE: config problem (e.g. MAPBOX_TOKEN missing and fallback failed).
 * - 404 + code NO_RESULTS: provider returned no results for the query.
 * - 500: unexpected geocoding failure.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Missing or too short query (use ?q=CityName)" },
      { status: 400 }
    )
  }

  try {
    const result = await geocodeAddress(q)
    if (!result) {
      return NextResponse.json(
        { error: "No results found", code: "NO_RESULTS" },
        { status: 404 }
      )
    }
    const parts = result.address.split(", ").map((s) => s.trim())
    const city = parts[0] ?? result.address
    const country = parts.length > 1 ? parts[parts.length - 1] : undefined
    return NextResponse.json({
      city,
      country,
      lat: result.lat,
      lng: result.lng,
      address: result.address,
    })
  } catch (error) {
    if (error instanceof GeocodingConfigError) {
      console.warn("[geocode/forward] Config unavailable:", error.message)
      return NextResponse.json(
        {
          error: "Location search is temporarily unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE",
        },
        { status: 503 }
      )
    }
    console.error("[geocode/forward] Error:", error)
    return NextResponse.json(
      { error: "Geocoding failed", code: "ERROR" },
      { status: 500 }
    )
  }
}
