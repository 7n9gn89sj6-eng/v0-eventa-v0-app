import { type NextRequest, NextResponse } from "next/server"

interface NominatimResponse {
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    country?: string
  }
  error?: string
}

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

  try {
    // Nominatim terms require User-Agent header
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Eventa-App/1.0 (https://eventa.app)",
          "Accept": "application/json",
        },
      },
    )

    if (!response.ok) {
      console.error("[geocode/reverse] Nominatim API error:", response.status)
      return NextResponse.json(
        { error: "Reverse geocoding failed", status: response.status },
        { status: 500 }
      )
    }

    const data: NominatimResponse = await response.json()

    if (data.error) {
      console.error("[geocode/reverse] Nominatim returned error:", data.error)
      return NextResponse.json(
        { error: data.error },
        { status: 500 }
      )
    }

    // Try to extract city name from address hierarchy
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      data.address?.county ||
      null

    const country = data.address?.country || null

    return NextResponse.json({
      city,
      country,
      address: data.address,
    })
  } catch (error) {
    console.error("[geocode/reverse] Reverse geocoding failed:", error)
    return NextResponse.json(
      { error: "Reverse geocoding failed" },
      { status: 500 }
    )
  }
}

