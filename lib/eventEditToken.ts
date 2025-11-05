import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"

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
    return "invalid"
  }

  for (const record of tokenRecords) {
    const isMatch = await bcrypt.compare(token, record.tokenHash)

    if (isMatch) {
      // Found matching token, check if expired
      const now = new Date()
      if (record.expires <= now) {
        return "expired"
      }

      // Token is valid
      return "ok"
    }
  }

  // No matching token found
  return "invalid"
}
