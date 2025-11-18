/**
 * Event visibility and status helpers
 * 
 * Centralized logic for determining which events should be visible to public users.
 * Admin-only code should continue using raw status/aiStatus checks for full visibility.
 */

import type { EventStatus, EventAIStatus, EventVisibilityShape } from "./types"

/**
 * Checks if an event is publicly visible to normal users.
 * 
 * An event is considered public when BOTH conditions are met:
 * - status === "PUBLISHED" (user has published it)
 * - aiStatus === "SAFE" (AI has approved it)
 * 
 * @param event - Event object with at least status and aiStatus fields
 * @returns true if the event should be visible to public users
 */
export function isEventPublic(event: EventVisibilityShape): boolean {
  return event.status === "PUBLISHED" && event.aiStatus === "SAFE"
}

/**
 * Checks if an event is in draft state.
 * Draft events are not visible to the public.
 * 
 * @param event - Event object with status field
 * @returns true if the event is a draft
 */
export function isEventDraft(event: { status: EventStatus }): boolean {
  return event.status === "DRAFT"
}

/**
 * Checks if an event is flagged for admin review.
 * These events need manual review before they can be published.
 * 
 * @param event - Event object with aiStatus field
 * @returns true if the event needs admin review
 */
export function isEventFlaggedForReview(event: { aiStatus: EventAIStatus | null }): boolean {
  return event.aiStatus === "NEEDS_REVIEW"
}

/**
 * Prisma where clause for querying only publicly visible events.
 * Use this in public-facing API routes and pages.
 * 
 * @example
 * ```ts
 * const events = await prisma.event.findMany({
 *   where: PUBLIC_EVENT_WHERE,
 *   ...
 * })
 * ```
 */
export const PUBLIC_EVENT_WHERE = {
  status: "PUBLISHED" as EventStatus,
  aiStatus: "SAFE" as EventAIStatus,
} as const
