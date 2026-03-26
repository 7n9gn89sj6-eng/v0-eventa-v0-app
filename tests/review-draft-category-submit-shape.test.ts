import { describe, it, expect } from "vitest"
import { eventCategoryPayloadSchema } from "@/lib/categories/canonical-event-category"

/**
 * Mirrors review-draft submit: category + optional custom label for create-simple body
 * (same fields validated by eventCategoryPayloadSchema before fetch).
 */
function categoryFieldsLikeReviewDraft(category: string, customOtherLabel: string) {
  return {
    category,
    subcategory: null,
    tags: [] as string[],
    customCategoryLabel: category === "OTHER" ? customOtherLabel.trim().slice(0, 40) : null,
    originalLanguage: null as string | null,
  }
}

describe("review-draft category fields → eventCategoryPayloadSchema", () => {
  it("accepts canonical non-OTHER with null customCategoryLabel", () => {
    const r = eventCategoryPayloadSchema.safeParse(categoryFieldsLikeReviewDraft("COMEDY", ""))
    expect(r.success).toBe(true)
  })

  it("accepts OTHER with non-empty label", () => {
    const r = eventCategoryPayloadSchema.safeParse(categoryFieldsLikeReviewDraft("OTHER", "Potluck dinner"))
    expect(r.success).toBe(true)
  })

  it("rejects OTHER with empty label", () => {
    const r = eventCategoryPayloadSchema.safeParse(categoryFieldsLikeReviewDraft("OTHER", "   "))
    expect(r.success).toBe(false)
  })

  it("rejects non-OTHER with customCategoryLabel set", () => {
    const r = eventCategoryPayloadSchema.safeParse({
      category: "MUSIC",
      subcategory: null,
      tags: [],
      customCategoryLabel: "oops",
      originalLanguage: null,
    })
    expect(r.success).toBe(false)
  })
})
