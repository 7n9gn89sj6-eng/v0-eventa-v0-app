import { describe, it, expect } from "vitest"
import { z } from "zod"
import { parseEventCategoryPayload } from "@/lib/categories/canonical-event-category"

describe("canonical event category payload", () => {
  it("accepts valid canonical category", () => {
    const r = parseEventCategoryPayload({
      category: "MUSIC",
      subcategory: " jazz ",
      tags: ["live", "live"],
      customCategoryLabel: null,
      originalLanguage: "en",
    })
    expect(r.category).toBe("MUSIC")
    expect(r.subcategory).toBe("jazz")
    expect(r.tags).toEqual(["live"])
    expect(r.customCategoryLabel).toBeNull()
    expect(r.originalLanguage).toBe("en")
  })

  it("requires customCategoryLabel for OTHER", () => {
    expect(() =>
      parseEventCategoryPayload({
        category: "OTHER",
        customCategoryLabel: "  ",
      }),
    ).toThrow(z.ZodError)
  })

  it("allows OTHER with label", () => {
    const r = parseEventCategoryPayload({
      category: "OTHER",
      customCategoryLabel: "Pottery swap",
    })
    expect(r.customCategoryLabel).toBe("Pottery swap")
  })

  it("rejects customCategoryLabel for non-OTHER", () => {
    expect(() =>
      parseEventCategoryPayload({
        category: "ART",
        customCategoryLabel: "Nope",
      }),
    ).toThrow(z.ZodError)
  })

  it("rejects unknown category", () => {
    expect(() =>
      parseEventCategoryPayload({
        category: "NOT_A_REAL_CATEGORY",
      }),
    ).toThrow(z.ZodError)
  })

  it("stores originalLanguage without affecting non-OTHER rules", () => {
    const r = parseEventCategoryPayload({
      category: "FILM",
      originalLanguage: "it",
    })
    expect(r.originalLanguage).toBe("it")
    expect(r.customCategoryLabel).toBeNull()
  })
})
