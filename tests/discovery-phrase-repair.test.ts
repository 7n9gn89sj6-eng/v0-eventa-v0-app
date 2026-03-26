import { describe, it, expect } from "vitest"
import { repairDiscoveryPhrases } from "@/lib/search/discovery-phrase-repair"
import { normalizeSearchUtterance, stripTextSearchStopwords } from "@/lib/search/normalize-search-utterance"
import { getExpandedTermGroups } from "@/lib/search/search-taxonomy"
import { resolveDiscoverApiSearchParams } from "@/lib/discover-effective-query"

describe("repairDiscoveryPhrases", () => {
  it('repairs "whats os …" to "whats on …" (Munich August case)', () => {
    expect(repairDiscoveryPhrases("whats os in Munich August 2026")).toBe("whats on in Munich August 2026")
  })

  it('leaves correct "whats on …" unchanged', () => {
    expect(repairDiscoveryPhrases("whats on in Munich August 2026")).toBe("whats on in Munich August 2026")
  })

  it("does not alter unrelated queries", () => {
    expect(repairDiscoveryPhrases("comedy in Berlin tonight")).toBe("comedy in Berlin tonight")
    expect(repairDiscoveryPhrases("live music oslo")).toBe("live music oslo")
  })

  it("repairs what os / what's os / whats om", () => {
    expect(repairDiscoveryPhrases("what os in Paris")).toBe("whats on in Paris")
    expect(repairDiscoveryPhrases("what's os in Paris")).toBe("whats on in Paris")
    expect(repairDiscoveryPhrases("whats om in Paris")).toBe("whats on in Paris")
  })

  it("after repair + normalize + stopword strip, text terms do not retain stray os token", () => {
    const repaired = repairDiscoveryPhrases("whats os in Munich August 2026")
    const n = normalizeSearchUtterance(repaired)
    let textQuery = n.replace(/\bMunich\b/gi, " ").replace(/\s+/g, " ").trim()
    textQuery = stripTextSearchStopwords(textQuery)
    const groups = getExpandedTermGroups(textQuery)
    const flat = groups.flat().map((t) => t.toLowerCase())
    expect(flat).not.toContain("os")
  })

  it("without repair, os can appear as a standalone term group (regression guard)", () => {
    const n = normalizeSearchUtterance("whats os in Munich August 2026")
    let textQuery = n.replace(/\bMunich\b/gi, " ").replace(/\s+/g, " ").trim()
    textQuery = stripTextSearchStopwords(textQuery)
    const groups = getExpandedTermGroups(textQuery)
    const primaryTokens = groups.map((g) => g[0]!.toLowerCase())
    expect(primaryTokens).toContain("os")
  })
})

describe("resolveDiscoverApiSearchParams + repair", () => {
  it("applies repair on discover path before parseSearchIntent", () => {
    const { apiQuery } = resolveDiscoverApiSearchParams({
      rawQuery: "whats os in Munich August 2026",
      selectedCategory: "All",
      cityFilter: "",
      countryFilter: "",
      structuredCategoryAuthoritative: false,
      structuredLocationAuthoritative: false,
    })
    expect(apiQuery).toBe("whats on in Munich August 2026")
  })
})
