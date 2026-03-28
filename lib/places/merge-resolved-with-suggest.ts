import type { SelectedPlaceWire } from "@/lib/places/selected-place"

/** Snapshot from forward geocode row (what the user saw in the suggestion list). */
export type SuggestRowForMerge = {
  primary: string
  city: string
  country: string
  region: string | null
  postcode: string | null
  lat: number | null
  lng: number | null
}

/** Last 4-digit token in the line (works for "… Fitzroy North Victoria 3068, Australia"). */
function extractAuPostcodeFromLine(line: string): string | null {
  const matches = line.match(/\b(\d{4})\b/g)
  if (!matches?.length) return null
  return matches[matches.length - 1] ?? null
}

/**
 * Mapbox retrieve-by-id sometimes returns a slimmer feature than forward suggest (e.g. street name only).
 * Merge list row + resolved wire so the committed place matches what the user selected.
 */
export function mergeResolvedPlaceWithSuggestion(
  resolved: SelectedPlaceWire,
  row: SuggestRowForMerge,
): SelectedPlaceWire {
  const listPrimary = row.primary.trim()
  const rAddr = (resolved.formattedAddress ?? "").trim()
  const formattedAddress =
    listPrimary.length > rAddr.length ? listPrimary : rAddr || listPrimary

  const postcodeFromLine = extractAuPostcodeFromLine(formattedAddress)
  const postcode =
    resolved.postcode?.trim() ||
    row.postcode?.trim() ||
    postcodeFromLine ||
    null

  const city = resolved.city?.trim() || row.city?.trim() || ""
  const country = resolved.country?.trim() || row.country?.trim() || ""
  const region = resolved.region?.trim() || row.region?.trim() || null

  const lat =
    typeof resolved.lat === "number" && Number.isFinite(resolved.lat)
      ? resolved.lat
      : typeof row.lat === "number" && Number.isFinite(row.lat)
        ? row.lat
        : null
  const lng =
    typeof resolved.lng === "number" && Number.isFinite(resolved.lng)
      ? resolved.lng
      : typeof row.lng === "number" && Number.isFinite(row.lng)
        ? row.lng
        : null

  return {
    ...resolved,
    formattedAddress,
    city,
    country,
    region,
    postcode,
    lat,
    lng,
  }
}
