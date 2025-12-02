/**
 * Event visibility and status helpers
 *
 * Centralized logic for determining which events should be visible to public users.
 * Admin-only code should continue using raw status/aiStatus checks for full visibility.
 */

import type { EventStatus, EventAIStatus, EventVisibilityShape, AdminDisplayStatus } from "./types"

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
 * \`\`\`ts
 * const events = await prisma.event.findMany({
 *   where: PUBLIC_EVENT_WHERE,
 *   ...
 * })
 * \`\`\`
 */
export const PUBLIC_EVENT_WHERE = {
  status: "PUBLISHED" as EventStatus,
  moderationStatus: "APPROVED",
} as const

/**
 * Get admin-friendly display status for an event.
 * Combines status and aiStatus into a single, clear representation.
 *
 * @param event - Event with status and aiStatus fields
 * @returns AdminDisplayStatus object for display in admin UI
 */
export function getAdminDisplayStatus(event: {
  status: EventStatus
  aiStatus: EventAIStatus | null
}): AdminDisplayStatus {
  if (event.status === "PUBLISHED" && event.aiStatus === "SAFE") {
    return {
      label: "Published",
      description: "This event is live and visible to the public.",
      variant: "success",
      icon: "check",
    }
  }

  if (event.aiStatus === "NEEDS_REVIEW") {
    return {
      label: "Needs Review",
      description: "This event needs a human review before it can go live.",
      variant: "warning",
      icon: "alert",
    }
  }

  if (event.aiStatus === "REJECTED") {
    return {
      label: "Rejected",
      description: "This event was rejected and is not visible to the public.",
      variant: "destructive",
      icon: "x",
    }
  }

  if (event.status === "ARCHIVED") {
    return {
      label: "Archived",
      description: "This event has been archived and is no longer active.",
      variant: "default",
      icon: "x",
    }
  }

  return {
    label: "Draft",
    description: "This event is not live yet and is only visible to admins.",
    variant: "default",
    icon: "clock",
  }
}
