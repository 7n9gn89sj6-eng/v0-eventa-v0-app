import { describe, it, expect } from "vitest"
import { buildDiscoverEventsFetchUrlSearchParams } from "@/lib/discover-events-fetch-params"
import type { NormalizeDiscoverQueryArgs } from "@/lib/discover-effective-query"

const baseArgs = (overrides: Partial<NormalizeDiscoverQueryArgs> = {}): NormalizeDiscoverQueryArgs => ({
  rawQuery: "",
  selectedCategory: "All",
  cityFilter: "",
  countryFilter: "",
  structuredCategoryAuthoritative: false,
  structuredLocationAuthoritative: false,
  ...overrides,
})

describe("buildDiscoverEventsFetchUrlSearchParams", () => {
  it("prefers URL city/country over stale React state (Melbourne nav after Sydney session)", () => {
    const sp = new URLSearchParams(
      "q=Melbourne+International+Comedy+Festival&city=Melbourne&country=Australia",
    )
    const discoverArgs = baseArgs({
      rawQuery: "Melbourne International Comedy Festival",
      cityFilter: "Sydney",
      countryFilter: "Australia",
    })
    const params = buildDiscoverEventsFetchUrlSearchParams({
      searchParams: sp,
      discoverArgs,
      selectedCategory: "All",
    })
    expect(params.get("query")).toContain("Melbourne")
    expect(params.get("city")).toBe("Melbourne")
    expect(params.get("country")).toBe("Australia")
    expect(params.get("city")).not.toBe("Sydney")
  })

  it("does not inject date_from/date_to when absent from URL even if discover state is stale", () => {
    const sp = new URLSearchParams("q=comedy&city=Melbourne&country=Australia")
    const discoverArgs = baseArgs({
      rawQuery: "comedy",
      cityFilter: "Melbourne",
      countryFilter: "Australia",
    })
    const params = buildDiscoverEventsFetchUrlSearchParams({
      searchParams: sp,
      discoverArgs,
      selectedCategory: "All",
    })
    expect(params.has("date_from")).toBe(false)
    expect(params.has("date_to")).toBe(false)
  })

  it("prefers UI category over stale URL category until router sync", () => {
    const sp = new URLSearchParams("q=gigs&category=music")
    const params = buildDiscoverEventsFetchUrlSearchParams({
      searchParams: sp,
      discoverArgs: baseArgs({ rawQuery: "gigs" }),
      selectedCategory: "Sports",
    })
    expect(params.get("category")).toBe("sports")
  })

  it("forwards date_from and date_to only when present on URL", () => {
    const sp = new URLSearchParams(
      "q=weekend&city=Sydney&country=Australia&date_from=2026-03-20&date_to=2026-03-22",
    )
    const params = buildDiscoverEventsFetchUrlSearchParams({
      searchParams: sp,
      discoverArgs: baseArgs({
        rawQuery: "weekend",
        cityFilter: "Sydney",
        countryFilter: "Australia",
      }),
      selectedCategory: "All",
    })
    expect(params.get("date_from")).toBe("2026-03-20")
    expect(params.get("date_to")).toBe("2026-03-22")
  })
})
