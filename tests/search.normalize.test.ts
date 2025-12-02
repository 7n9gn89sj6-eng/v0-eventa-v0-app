import { describe, it, expect } from "vitest"
import { normalizeQuery } from "@/lib/search/query-normalization"

describe("normalizeQuery", () => {
  it("lowercases & trims", () => {
    const result = normalizeQuery("  Café  ")
    expect(result.normalized).toContain("café")
  })

  it("removes dup spaces", () => {
    const result = normalizeQuery("live   music")
    expect(result.normalized).toBe("live music")
  })
})
