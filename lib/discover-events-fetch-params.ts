import {
  resolveDiscoverApiSearchParams,
  type NormalizeDiscoverQueryArgs,
} from "@/lib/discover-effective-query"
import { sanitizeQueryParam } from "@/lib/search/sanitize-query-param"

/**
 * Build GET `/api/search/events` query string from the live URL plus Discover UI state.
 * URL wins for q/city/country/dates when present so client navigations (e.g. SmartInputBar)
 * cannot race stale React state.
 */
export function buildDiscoverEventsFetchUrlSearchParams(args: {
  searchParams: URLSearchParams
  discoverArgs: NormalizeDiscoverQueryArgs
  selectedCategory: string
}): URLSearchParams {
  const { searchParams, discoverArgs, selectedCategory } = args

  const urlQ = sanitizeQueryParam(searchParams.get("q")).trim()
  const mergedQ = urlQ || discoverArgs.rawQuery.trim()

  const urlCity = (searchParams.get("city") ?? "").trim()
  const urlCountry = (searchParams.get("country") ?? "").trim()
  const mergedCity = urlCity || discoverArgs.cityFilter.trim()
  const mergedCountry = urlCountry || discoverArgs.countryFilter.trim()

  const { apiQuery, city: apiCity, country: apiCountry } = resolveDiscoverApiSearchParams({
    ...discoverArgs,
    rawQuery: mergedQ,
    cityFilter: mergedCity,
    countryFilter: mergedCountry,
  })

  const params = new URLSearchParams()
  if (apiQuery) params.set("query", apiQuery)
  if (apiCity.trim()) params.set("city", apiCity.trim())
  if (apiCountry.trim()) params.set("country", apiCountry.trim())

  const urlCat = (searchParams.get("category") ?? "").trim()
  const uiCat =
    selectedCategory && selectedCategory !== "All" ? selectedCategory.toLowerCase() : ""
  // Prefer UI category so the request matches the dropdown immediately; URL sync catches up on the next navigation tick.
  const catForApi = uiCat || urlCat
  if (catForApi) params.set("category", catForApi)

  const df = (searchParams.get("date_from") ?? "").trim()
  const dt = (searchParams.get("date_to") ?? "").trim()
  if (df) params.set("date_from", df)
  if (dt) params.set("date_to", dt)

  return params
}
