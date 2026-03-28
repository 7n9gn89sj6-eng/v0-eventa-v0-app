import type { SelectedPlaceWire } from "@/lib/places/selected-place"
import {
  extractLeadingNumberedStreetFromQuery,
  lineHasNumberedStreetSegment,
  looksLikeStreetNameSegment,
  queryHasLeadingStreetNumber,
} from "@/lib/places/mapbox-suggest-helpers"

/** Snapshot from forward geocode row (what the user saw in the suggestion list). */
export type SuggestRowForMerge = {
  primary: string
  city: string
  country: string
  region: string | null
  postcode: string | null
  lat: number | null
  lng: number | null
  /** Optional typed query so POI picks can recover a civic line the user typed. */
  typedQuery?: string
}

/** Last 4-digit token in the line (works for "… Fitzroy North Victoria 3068, Australia"). */
function extractAuPostcodeFromLine(line: string): string | null {
  const matches = line.match(/\b(\d{4})\b/g)
  if (!matches?.length) return null
  return matches[matches.length - 1] ?? null
}

/** Prefer a line that actually includes a civic number; otherwise keep longer (prior behaviour). */
function pickFormattedAddressLine(listPrimary: string, rAddr: string): string {
  const a = listPrimary.trim()
  const b = rAddr.trim()
  const aNum = lineHasNumberedStreetSegment(a)
  const bNum = lineHasNumberedStreetSegment(b)
  if (aNum && !bNum) return a || b
  if (bNum && !aNum) return b || a
  if (a.length > b.length) return a
  return b || a
}

/** Insert typed civic line into a POI {@code place_name}-style string when Mapbox omitted the number. */
export function injectCivicForPoiLine(formattedAddress: string, venueName: string, civic: string): string {
  const civicTrim = civic.trim()
  const ven = venueName.trim()
  if (!civicTrim || !ven) return formattedAddress
  if (formattedAddress.toLowerCase().includes(civicTrim.toLowerCase())) return formattedAddress

  const parts = formattedAddress
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return `${ven}, ${civicTrim}`

  const head = parts[0]!.toLowerCase()
  const venLc = ven.toLowerCase()
  const venueFirst = head === venLc || head.startsWith(`${venLc} `)

  if (venueFirst) {
    if (
      parts.length >= 2 &&
      !lineHasNumberedStreetSegment(parts[1]!) &&
      looksLikeStreetNameSegment(parts[1]!)
    ) {
      return [parts[0], civicTrim, ...parts.slice(2)].join(", ")
    }
    return [parts[0], civicTrim, ...parts.slice(1)].join(", ")
  }
  return `${ven}, ${civicTrim}, ${formattedAddress}`
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
  let formattedAddress = pickFormattedAddressLine(listPrimary, rAddr)

  const venue = resolved.venueName?.trim()
  const typedQuery = row.typedQuery?.trim() ?? ""
  if (venue && typedQuery && queryHasLeadingStreetNumber(typedQuery) && !lineHasNumberedStreetSegment(formattedAddress)) {
    const civic = extractLeadingNumberedStreetFromQuery(typedQuery)
    if (civic) formattedAddress = injectCivicForPoiLine(formattedAddress, venue, civic)
  }

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
