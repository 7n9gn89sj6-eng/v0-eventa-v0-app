import { db } from "./db"

export async function checkRateLimit(
  userId: string,
  action: "event_submission",
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const windowStart = new Date(Date.now() - windowMs)

  const count = await db.eventAuditLog.count({
    where: {
      actorId: userId,
      action: "created",
      createdAt: {
        gte: windowStart,
      },
    },
  })

  const allowed = count < limit
  const remaining = Math.max(0, limit - count)
  const resetAt = new Date(Date.now() + windowMs)

  return { allowed, remaining, resetAt }
}
