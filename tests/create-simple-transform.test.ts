import { describe, it, expect } from "vitest"
import { z } from "zod"
import { parseEventCategoryPayload } from "@/lib/categories/canonical-event-category"
import {
  CREATE_SIMPLE_UNRESOLVED_CATEGORY_LABEL,
  parseCreatorEmailForCreateSimple,
  pickResolvedCategoryToken,
  resolveCreateSimpleCategoryAndLabel,
} from "@/lib/events/create-simple-transform"

describe("create-simple transform", () => {
  describe("pickResolvedCategoryToken / resolveCreateSimpleCategoryAndLabel", () => {
    it("maps literal auto on body to unresolved OTHER + label", () => {
      expect(pickResolvedCategoryToken({ category: "auto" })).toBe("")
      const r = resolveCreateSimpleCategoryAndLabel({ category: "auto" })
      expect(r.category).toBe("OTHER")
      expect(r.customCategoryLabel).toBe(CREATE_SIMPLE_UNRESOLVED_CATEGORY_LABEL)
    })

    it("resolved category + label passes submit category schema (auto → OTHER)", () => {
      const r = resolveCreateSimpleCategoryAndLabel({ category: "auto" })
      expect(() =>
        parseEventCategoryPayload({
          category: r.category,
          subcategory: null,
          tags: [],
          customCategoryLabel: r.customCategoryLabel,
          originalLanguage: null,
        }),
      ).not.toThrow()
    })

    it("uses body category when both user and extraction would be auto but body sends resolved string", () => {
      const r = resolveCreateSimpleCategoryAndLabel({
        category: "MUSIC",
      })
      expect(r.category).toBe("MUSIC")
      expect(r.customCategoryLabel).toBeNull()
    })

    it("accepts legacy broad slug from body", () => {
      const r = resolveCreateSimpleCategoryAndLabel({ category: "food_drink" })
      expect(r.category).toBe("food_drink")
      expect(r.customCategoryLabel).toBeNull()
    })

    it("skips auto on body and reads extraction category", () => {
      const r = resolveCreateSimpleCategoryAndLabel({
        category: "auto",
        extraction: { category: "COMEDY" },
      })
      expect(r.category).toBe("COMEDY")
    })

    it("uses custom labels only for OTHER path when unresolved", () => {
      const r = resolveCreateSimpleCategoryAndLabel({
        category: "auto",
        customCategoryLabel: "Pottery night",
      })
      expect(r.category).toBe("OTHER")
      expect(r.customCategoryLabel).toBe("Pottery night")
    })
  })

  describe("parseCreatorEmailForCreateSimple", () => {
    it("accepts valid email", () => {
      expect(parseCreatorEmailForCreateSimple("  a@b.co  ")).toEqual({ ok: true, email: "a@b.co" })
    })
    it("rejects missing or invalid", () => {
      expect(parseCreatorEmailForCreateSimple("")).toEqual({ ok: false })
      expect(parseCreatorEmailForCreateSimple(null)).toEqual({ ok: false })
      expect(parseCreatorEmailForCreateSimple("not-an-email")).toEqual({ ok: false })
    })
  })

  it("review-shaped minimal payload: category + creator satisfy create-simple gates", () => {
    const body = {
      category: "auto",
      title: "Trivia",
      description: "Weekly quiz",
      creatorEmail: "host@example.com",
    } as Record<string, unknown>
    const cat = resolveCreateSimpleCategoryAndLabel(body)
    const em = parseCreatorEmailForCreateSimple(body.creatorEmail)
    expect(cat.category).toBe("OTHER")
    expect(em.ok).toBe(true)
    expect(z.string().email().safeParse(em.ok ? em.email : "").success).toBe(true)
    parseEventCategoryPayload({
      category: cat.category,
      subcategory: null,
      tags: [],
      customCategoryLabel: cat.customCategoryLabel,
      originalLanguage: null,
    })
  })
})
