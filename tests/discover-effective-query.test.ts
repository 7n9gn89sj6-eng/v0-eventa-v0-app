import { describe, it, expect } from "vitest"
import {
  normalizeDiscoverFreeTextForStructuredFilters,
  resolveDiscoverApiSearchParams,
} from "@/lib/discover-effective-query"

describe("normalizeDiscoverFreeTextForStructuredFilters", () => {
  it("explicit query place overrides structured Berlin; strips conflicting category only", () => {
    const out = normalizeDiscoverFreeTextForStructuredFilters({
      rawQuery: "music in Paris this weekend",
      selectedCategory: "Markets",
      cityFilter: "Berlin",
      countryFilter: "Germany",
      structuredCategoryAuthoritative: true,
      structuredLocationAuthoritative: true,
    })
    const lower = out.toLowerCase()
    expect(lower).not.toContain("music")
    expect(lower).toContain("paris")
    expect(lower).toMatch(/weekend/)
  })

  it("does not strip category or place when structured controls were not used as authority", () => {
    const out = normalizeDiscoverFreeTextForStructuredFilters({
      rawQuery: "music in Paris this weekend",
      selectedCategory: "Markets",
      cityFilter: "Berlin",
      countryFilter: "Germany",
      structuredCategoryAuthoritative: false,
      structuredLocationAuthoritative: false,
    })
    expect(out.toLowerCase()).toContain("music")
    expect(out.toLowerCase()).toContain("paris")
  })

  it("keeps generic qualifiers like free when stripping conflicting category terms", () => {
    const out = normalizeDiscoverFreeTextForStructuredFilters({
      rawQuery: "free live music tonight",
      selectedCategory: "Sports",
      cityFilter: "",
      countryFilter: "",
      structuredCategoryAuthoritative: true,
      structuredLocationAuthoritative: false,
    })
    expect(out.toLowerCase()).toContain("free")
    expect(out.toLowerCase()).toContain("tonight")
    expect(out.toLowerCase()).not.toContain("music")
  })
})

describe("resolveDiscoverApiSearchParams", () => {
  it("Paris HYROX + Melbourne UI sends Paris/France and full query (no stale AU filter)", () => {
    const r = resolveDiscoverApiSearchParams({
      rawQuery: "Paris HYROX",
      selectedCategory: "All",
      cityFilter: "Melbourne",
      countryFilter: "Australia",
      structuredCategoryAuthoritative: false,
      structuredLocationAuthoritative: true,
    })
    expect(r.apiQuery.toLowerCase()).toContain("paris")
    expect(r.apiQuery.toLowerCase()).toContain("hyrox")
    expect(r.city.toLowerCase()).toBe("paris")
    expect(r.country.toLowerCase()).toContain("france")
  })

  it("London Theatre + Paris, France UI sends London/UK and full query", () => {
    const r = resolveDiscoverApiSearchParams({
      rawQuery: "London Theatre",
      selectedCategory: "All",
      cityFilter: "Paris",
      countryFilter: "France",
      structuredCategoryAuthoritative: false,
      structuredLocationAuthoritative: true,
    })
    expect(r.apiQuery.toLowerCase()).toContain("london")
    expect(r.city.toLowerCase()).toBe("london")
    expect(r.country.toLowerCase()).toContain("kingdom")
  })

  it("things to do Sydney + stale Paris UI sends Sydney/Australia (not to-do false place)", () => {
    const r = resolveDiscoverApiSearchParams({
      rawQuery: "things to do Sydney",
      selectedCategory: "All",
      cityFilter: "Paris",
      countryFilter: "France",
      structuredCategoryAuthoritative: false,
      structuredLocationAuthoritative: true,
    })
    expect(r.city.toLowerCase()).toBe("sydney")
    expect(r.country.toLowerCase()).toContain("australia")
  })

  it("live music Munich + Melbourne UI sends Munich/Germany (trailing known city beats picker)", () => {
    const r = resolveDiscoverApiSearchParams({
      rawQuery: "live music Munich",
      selectedCategory: "All",
      cityFilter: "Melbourne",
      countryFilter: "Australia",
      structuredCategoryAuthoritative: false,
      structuredLocationAuthoritative: true,
    })
    expect(r.apiQuery.toLowerCase()).toContain("munich")
    expect(r.apiQuery.toLowerCase()).toContain("music")
    expect(r.city.toLowerCase()).toBe("munich")
    expect(r.country.toLowerCase()).toContain("germany")
  })

  it("live music munich lowercase + Melbourne UI sends Munich/Germany", () => {
    const r = resolveDiscoverApiSearchParams({
      rawQuery: "live music munich",
      selectedCategory: "All",
      cityFilter: "Melbourne",
      countryFilter: "Australia",
      structuredCategoryAuthoritative: false,
      structuredLocationAuthoritative: true,
    })
    expect(r.city.toLowerCase()).toBe("munich")
    expect(r.country.toLowerCase()).toContain("germany")
  })
})
