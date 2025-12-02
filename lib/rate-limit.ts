import { db } from "./db"

export async function checkRateLimit(
  userId: string,
  action: "event_submission",
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
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
  } catch (error) {
    // Database failure - degrade gracefully by allowing the request
    console.error("[RateLimit] Database query failed, disabling rate limiting for this request:", error)
    
    // Return permissive values when rate limiting cannot be checked
    return {
      allowed: true,
      remaining: limit, // Full limit available since we can't check
      resetAt: new Date(Date.now() + windowMs),
    }
  }
}
