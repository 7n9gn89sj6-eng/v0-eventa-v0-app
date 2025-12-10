import { db } from "@/lib/db"
import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { createAuditLog } from "@/lib/audit-log"

/**
 * Creates an event edit token for the given event.
 * Returns the plain token string (for emailing to the user).
 */
export async function createEventEditToken(
  eventId: string,
  endsAt: Date
): Promise<string> {
  const token = randomUUID()
  const tokenHash = await bcrypt.hash(token, 10)

  // Token expires in 30 days (endsAt is currently unused, kept for compatibility)
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  try {
    const row = await db.eventEditToken.create({
      data: {
        tokenHash,
        eventId,
        expires,
      },
    })

    console.log("[edit-token] Created token row", {
      id: row.id,
      eventId: row.eventId,
      expires: row.expires.toISOString(),
    })
  } catch (err) {
    console.error("[edit-token] FAILED to create token row for event", eventId, err)
    throw err
  }

  return token
}

/**
 * Validates an event edit token.
 * Returns "ok", "expired", or "invalid".
 */
export async function validateEventEditToken(
  eventId: string,
  token: string
): Promise<"ok" | "expired" | "invalid"> {
  const tokenRecords = await db.eventEditToken.findMany({
    where: { eventId },
    select: {
      tokenHash: true,
      expires: true,
    },
  })

  if (tokenRecords.length === 0) {
    console.warn("[edit-token] No tokens found for event", eventId)

    await createAuditLog({
      eventId,
      action: "EDIT_TOKEN_INVALID",
      details: "No edit tokens found for this event",
      metadata: { tokenProvided: token.substring(0, 8) + "..." },
    }).catch((err) =>
      console.error("[edit-token] Failed to create audit log:", err)
    )

    return "invalid"
  }

  for (const record of tokenRecords) {
    const isMatch = await bcrypt.compare(token, record.tokenHash)

    if (isMatch) {
      const now = new Date()

      if (record.expires <= now) {
        console.warn("[edit-token] Token expired for event", eventId)

        await createAuditLog({
          eventId,
          action: "EDIT_TOKEN_EXPIRED",
          details: `Edit token expired on ${record.expires.toISOString()}`,
          metadata: {
            expiredAt: record.expires.toISOString(),
            attemptedAt: now.toISOString(),
          },
        }).catch((err) =>
          console.error("[edit-token] Failed to create audit log:", err)
        )

        return "expired"
      }

      console.log("[edit-token] Token validation successful for event", eventId)
      return "ok"
    }
  }

  console.warn("[edit-token] Token hash mismatch for event", eventId)

  await createAuditLog({
    eventId,
    action: "EDIT_TOKEN_INVALID",
    details: "Token hash does not match any stored tokens",
    metadata: { tokenProvided: token.substring(0, 8) + "..." },
  }).catch((err) =>
    console.error("[edit-token] Failed to create audit log:", err)
  )

  return "invalid"
}

