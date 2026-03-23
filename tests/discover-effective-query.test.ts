import { describe, it, expect } from "vitest"
import { normalizeDiscoverFreeTextForStructuredFilters } from "@/lib/discover-effective-query"

describe("normalizeDiscoverFreeTextForStructuredFilters", () => {
  it("removes stale music and Paris when structured category is Markets and location is Berlin; keeps weekend phrasing", () => {
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
    expect(lower).not.toContain("paris")
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
