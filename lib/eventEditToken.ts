import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

/**
 * Creates an event edit token for the given event
 * @param eventId - The ID of the event
 * @param endsAt - The end date/time of the event (unused, kept for backward compatibility)
 * @returns The generated token string
 */
export async function createEventEditToken(eventId: string, endsAt: Date): Promise<string> {
  // Generate a random UUID token
  const token = randomUUID()

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // now + 30 days

  // Store in database
  await prisma.eventEditToken.create({
    data: {
      token,
      eventId,
      expires,
    },
  })

  return token
}

/**
 * Validates an event edit token
 * @param eventId - The ID of the event
 * @param token - The token to validate
 * @returns "ok" if valid, "expired" if expired, "invalid" if not found or mismatched
 */
export async function validateEventEditToken(eventId: string, token: string): Promise<"ok" | "expired" | "invalid"> {
  // Load token from database
  const tokenRecord = await prisma.eventEditToken.findUnique({
    where: { token },
    select: {
      eventId: true,
      expires: true,
    },
  })

  // Check if token exists and eventId matches
  if (!tokenRecord || tokenRecord.eventId !== eventId) {
    return "invalid"
  }

  const now = new Date()
  if (tokenRecord.expires <= now) {
    return "expired"
  }

  // Token is valid
  return "ok"
}
