/**
 * Shared Nominatim reverse geocode (server-only). Used by /api/geocode/reverse and search enrichment.
 */

interface NominatimResponse {
  address?: {
    city?: string
    town?: string
    suburb?: string
    locality?: string
    village?: string
    municipality?: string
    county?: string
    country?: string
  }
  error?: string
}

export type ReverseGeocodeNominatimResult = {
  city: string | null
  country: string | null
  address: NominatimResponse["address"]
}

/**
 * Reverse geocode coordinates via Nominatim. Returns null on network/API failure.
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeNominatimResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Eventa-App/1.0 (https://eventa.app)",
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[reverse-nominatim] Nominatim API error: ${response.status} - ${errorText}`)
      return null
    }

    const data: NominatimResponse = await response.json()

    if (data.error) {
      console.error("[reverse-nominatim] Nominatim returned error:", data.error)
      return null
    }

    let country = data.address?.country || null
    if (country) {
      const countryLower = country.toLowerCase()
      if (countryLower.includes("australia")) {
        country = "Australia"
      } else if (countryLower.includes("united states") || countryLower === "usa" || countryLower === "us") {
        country = "United States"
      } else if (countryLower.includes("united kingdom") || countryLower === "uk") {
        country = "United Kingdom"
      }
    }

    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.suburb ||
      data.address?.locality ||
      data.address?.village ||
      data.address?.municipality ||
      data.address?.county ||
      country

    return {
      city: city ?? null,
      country,
      address: data.address,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    console.error("[reverse-nominatim] Reverse geocoding failed:", error)
    return null
  }
}
