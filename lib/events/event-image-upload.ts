/** Max poster/banner size for simple event flow (Phase 1). */
export const EVENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export const EVENT_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

const ALLOWED_SET = new Set<string>(EVENT_IMAGE_ALLOWED_MIME_TYPES)

export type ValidateEventImageFileInput = {
  size: number
  type: string
}

export type ValidateEventImageFileResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

/**
 * Shared validation for POST /api/events/event-image and client-side hints.
 */
export function validateEventImageFile(file: ValidateEventImageFileInput): ValidateEventImageFileResult {
  if (file.size === 0) {
    return { ok: false, error: "File is empty.", status: 400 }
  }
  if (file.size > EVENT_IMAGE_MAX_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller.", status: 400 }
  }
  const t = (file.type || "").toLowerCase()
  if (!t || !ALLOWED_SET.has(t)) {
    return { ok: false, error: "Please use a JPEG, PNG, or WebP image.", status: 400 }
  }
  return { ok: true }
}

export function extensionForImageMime(mime: string): "jpg" | "png" | "webp" {
  const t = mime.toLowerCase()
  if (t === "image/png") return "png"
  if (t === "image/webp") return "webp"
  return "jpg"
}

export type EventPosterImageExt = "jpg" | "png" | "webp"

/** R2 object key prefix `events/{id}.{ext}` — `id` should be a UUID from `randomUUID()`. */
export function formatEventPosterObjectKey(id: string, ext: EventPosterImageExt): string {
  return `events/${id}.${ext}`
}
