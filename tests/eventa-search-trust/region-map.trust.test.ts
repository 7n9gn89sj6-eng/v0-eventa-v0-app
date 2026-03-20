import { describe, expect, it } from "vitest"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"
import { resolveSearchPlan } from "@/app/lib/search/resolveSearchPlan"
import { resolveRegionCountries } from "@/lib/search/region-map"

/**
 * Every value from parseSearchIntent REGION_PATTERNS must resolve to executable country lists.
 * Keep in sync with app/lib/search/parseSearchIntent.ts REGION_PATTERNS.
 */
const REGION_LABELS_FROM_INTENT = [
  "Western Europe",
  "Eastern Europe",
  "Southern Europe",
  "Northern Europe",
  "Europe",
  "Scandinavia",
  "Middle East",
  "South America",
  "North America",
  "Western Australia",
] as const

describe("Eventa trust: region map ↔ intent vocabulary", () => {
  it("resolveRegionCountries returns a non-empty list for every intent region label", () => {
    for (const label of REGION_LABELS_FROM_INTENT) {
      const countries = resolveRegionCountries(label)
      expect(countries, label).not.toBeNull()
      expect(countries!.length, label).toBeGreaterThan(0)
    }
  })

  it("resolveSearchPlan carries countries for each region label under region scope (query overrides UI)", () => {
    const queries: Record<string, string> = {
      "Western Europe": "festivals Western Europe",
      "Eastern Europe": "events Eastern Europe",
      "Southern Europe": "food Southern Europe",
      "Northern Europe": "music Northern Europe",
      Europe: "things Europe",
      Scandinavia: "gigs Scandinavia",
      "Middle East": "events Middle East",
      "South America": "carnival South America",
      "North America": "shows North America",
      "Western Australia": "markets Western Australia",
    }

    for (const [expectedLabel, query] of Object.entries(queries)) {
      const intent = parseSearchIntent(query)
      expect(intent.place?.region, query).toBe(expectedLabel)
      expect(intent.scope, query).toBe("region")

      const plan = resolveSearchPlan(intent, { city: "Melbourne", country: "Australia" })
      expect(plan.scope, query).toBe("region")
      expect(plan.location.city, query).toBeUndefined()
      expect(plan.location.country, query).toBeUndefined()
      expect(plan.location.region, query).toBe(expectedLabel)
      expect(plan.location.countries?.length, query).toBeGreaterThan(0)
    }
  })
})
