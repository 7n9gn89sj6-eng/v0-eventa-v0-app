import { db } from "./db"

export async function createAuditLog({
  eventId,
  actor,
  actorId,
  action,
  oldStatus,
  newStatus,
  notes,
  reason,
}: {
  eventId: string
  actor: "user" | "ai" | "admin"
  actorId?: string
  action: string
  oldStatus?: string
  newStatus?: string
  notes?: string
  reason?: string
}) {
  try {
    await db.eventAuditLog.create({
      data: {
        eventId,
        actor,
        actorId,
        action,
        oldStatus,
        newStatus,
        notes,
        reason,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to create audit log:", error)
  }
}
