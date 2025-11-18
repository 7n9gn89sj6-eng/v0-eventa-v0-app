import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { createAuditLog } from "@/lib/audit-log"

/**
 * Creates an event edit token for the given event
 * @param eventId - The ID of the event
 * @param endsAt - The end date/time of the event (unused, kept for backward compatibility)
 * @returns The generated token string (plain text - to be sent via email)
 */
export async function createEventEditToken(eventId: string, endsAt: Date): Promise<string> {
  const token = randomUUID()

  const tokenHash = await bcrypt.hash(token, 10)

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // now + 30 days

  await prisma.eventEditToken.create({
    data: {
      tokenHash,
      eventId,
      expires,
    },
  })

  return token
}

/**
 * Validates an event edit token
 * @param eventId - The ID of the event
 * @param token - The plain text token to validate
 * @returns "ok" if valid, "expired" if expired, "invalid" if not found or mismatched
 */
export async function validateEventEditToken(eventId: string, token: string): Promise<"ok" | "expired" | "invalid"> {
  const tokenRecords = await prisma.eventEditToken.findMany({
    where: { eventId },
    select: {
      tokenHash: true,
      expires: true,
    },
  })

  if (tokenRecords.length === 0) {
    console.warn("[v0] Token validation failed: no tokens found for event", eventId)
    
    await createAuditLog({
      eventId,
      action: "EDIT_TOKEN_INVALID",
      details: "No edit tokens found for this event",
      metadata: {
        tokenProvided: token.substring(0, 8) + "...", // Log first 8 chars for debugging
      },
    }).catch((err) => console.error("[v0] Failed to create audit log:", err))
    
    return "invalid"
  }

  for (const record of tokenRecords) {
    const isMatch = await bcrypt.compare(token, record.tokenHash)

    if (isMatch) {
      const now = new Date()
      if (record.expires <= now) {
        console.warn("[v0] Token validation failed: token expired for event", eventId)
        
        await createAuditLog({
          eventId,
          action: "EDIT_TOKEN_EXPIRED",
          details: `Edit token expired on ${record.expires.toISOString()}`,
          metadata: {
            expiredAt: record.expires.toISOString(),
            attemptedAt: now.toISOString(),
          },
        }).catch((err) => console.error("[v0] Failed to create audit log:", err))
        
        return "expired"
      }

      console.log("[v0] Token validation successful for event", eventId)
      return "ok"
    }
  }

  console.warn("[v0] Token validation failed: token hash mismatch for event", eventId)
  
  await createAuditLog({
    eventId,
    action: "EDIT_TOKEN_INVALID",
    details: "Token hash does not match any stored tokens",
    metadata: {
      tokenProvided: token.substring(0, 8) + "...",
    },
  }).catch((err) => console.error("[v0] Failed to create audit log:", err))
  
  return "invalid"
}
