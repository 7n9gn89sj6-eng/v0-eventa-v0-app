import { describe, expect, it } from "vitest"
import { asSchema, jsonSchema } from "@ai-sdk/provider-utils"

/**
 * Regression: `generateObject` passes schemas through `asSchema`.
 * A plain JSON-schema object hits the lazy-schema branch and is invoked as a function
 * (`TypeError: schema is not a function` / minified `e is not a function`).
 * Wrapping with `jsonSchema()` (see `lib/ai-extraction.ts`) fixes extract-event preview.
 */
describe("AI SDK schema shape for generateObject", () => {
  const raw = {
    type: "object" as const,
    properties: {
      title: { type: "string" as const, description: "Title" },
    },
    required: ["title" as const],
  }

  it("rejects raw JSON-schema objects for asSchema (SDK v6)", () => {
    expect(() => asSchema(raw as never)).toThrow(/not a function/)
  })

  it("accepts jsonSchema(...) wrapper", () => {
    expect(() => asSchema(jsonSchema(raw))).not.toThrow()
  })
})
