import { describe, it, expect } from "vitest"
import {
  EVENT_IMAGE_MAX_BYTES,
  validateEventImageFile,
  extensionForImageMime,
  formatEventPosterObjectKey,
} from "@/lib/events/event-image-upload"

describe("validateEventImageFile", () => {
  it("accepts jpeg/png/webp under limit", () => {
    expect(validateEventImageFile({ size: 100, type: "image/jpeg" })).toEqual({ ok: true })
    expect(validateEventImageFile({ size: 1, type: "image/png" })).toEqual({ ok: true })
    expect(validateEventImageFile({ size: 500, type: "image/webp" })).toEqual({ ok: true })
  })
  it("rejects empty file", () => {
    const r = validateEventImageFile({ size: 0, type: "image/jpeg" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(400)
  })
  it("rejects over 5MB", () => {
    const r = validateEventImageFile({ size: EVENT_IMAGE_MAX_BYTES + 1, type: "image/jpeg" })
    expect(r.ok).toBe(false)
  })
  it("rejects wrong mime", () => {
    expect(validateEventImageFile({ size: 100, type: "image/gif" }).ok).toBe(false)
    expect(validateEventImageFile({ size: 100, type: "application/pdf" }).ok).toBe(false)
  })
})

describe("extensionForImageMime", () => {
  it("maps types", () => {
    expect(extensionForImageMime("image/jpeg")).toBe("jpg")
    expect(extensionForImageMime("image/png")).toBe("png")
    expect(extensionForImageMime("image/webp")).toBe("webp")
  })
})

describe("formatEventPosterObjectKey", () => {
  it("builds events/{id}.{ext}", () => {
    expect(formatEventPosterObjectKey("550e8400-e29b-41d4-a716-446655440000", "jpg")).toBe(
      "events/550e8400-e29b-41d4-a716-446655440000.jpg",
    )
    expect(formatEventPosterObjectKey("abc", "webp")).toBe("events/abc.webp")
  })
})
