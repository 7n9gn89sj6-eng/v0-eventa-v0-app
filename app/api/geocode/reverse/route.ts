import { type NextRequest, NextResponse } from "next/server"
import { reverseGeocodeNominatim } from "@/lib/geocode/reverse-nominatim"

/**
 * Server-side reverse geocoding API route
 * Proxies requests to Nominatim to avoid CORS issues
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Missing lat or lng parameters" },
      { status: 400 }
    )
  }

  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)

  if (isNaN(latNum) || isNaN(lngNum)) {
    return NextResponse.json(
      { error: "Invalid lat or lng values" },
      { status: 400 }
    )
  }

  const result = await reverseGeocodeNominatim(latNum, lngNum)
  if (!result) {
    return NextResponse.json({ error: "Reverse geocoding failed" }, { status: 500 })
  }

  console.log("[geocode/reverse] Nominatim response:", JSON.stringify(result.address, null, 2))
  console.log("[geocode/reverse] Extracted:", { city: result.city, country: result.country, fullAddress: result.address })

  return NextResponse.json({
    city: result.city,
    country: result.country,
    address: result.address,
  })
}

