import { z } from "zod"

/**
 * Shared logic for POST /api/events/create-simple → canonical /api/events/submit payload.
 * Keeps category coercion and labels testable without booting the full submit pipeline.
 */

export const CREATE_SIMPLE_UNRESOLVED_CATEGORY_LABEL = "Event type not specified"

function trimCategoryCandidate(value: unknown): string {
  if (value == null) return ""
  const s = String(value).trim()
  if (!s) return ""
  if (s.toLowerCase() === "auto") return ""
  return s
}

/**
 * Pick a non-empty, non-auto category token from body or nested extraction.
 */
export function pickResolvedCategoryToken(body: Record<string, unknown>): string {
  const fromBody = trimCategoryCandidate(body.category)
  if (fromBody) return fromBody
  const extraction = body.extraction as Record<string, unknown> | undefined
  return trimCategoryCandidate(extraction?.category)
}

function trimCustomLabel(value: unknown): string {
  if (value == null) return ""
  return String(value).trim().slice(0, 40)
}

/**
 * Category + custom label for submit. Never passes literal "auto" as category.
 * Unresolved → OTHER + a non-empty label (submit schema requirement for OTHER).
 */
export function resolveCreateSimpleCategoryAndLabel(body: Record<string, unknown>): {
  category: string
  customCategoryLabel: string | null
} {
  const trimmed = pickResolvedCategoryToken(body)
  const bodyLbl = trimCustomLabel(body.customCategoryLabel)
  const extraction = body.extraction as Record<string, unknown> | undefined
  const exLbl =
    typeof extraction?.customCategoryLabel === "string" ? trimCustomLabel(extraction.customCategoryLabel) : ""

  if (!trimmed) {
    const label = (bodyLbl || exLbl || CREATE_SIMPLE_UNRESOLVED_CATEGORY_LABEL).slice(0, 40)
    return { category: "OTHER", customCategoryLabel: label }
  }

  // Explicit category: only top-level custom label (submit rejects custom when not OTHER).
  return {
    category: trimmed,
    customCategoryLabel: bodyLbl || null,
  }
}

export function parseCreatorEmailForCreateSimple(raw: unknown): { ok: true; email: string } | { ok: false } {
  const s = typeof raw === "string" ? raw.trim() : ""
  const r = z.string().email().safeParse(s)
  if (!r.success) return { ok: false }
  return { ok: true, email: r.data }
}
