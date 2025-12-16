import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";

export async function createEventEditToken(eventId: string, endDate?: Date): Promise<string> {
  const token = randomUUID();
  const tokenHash = await bcrypt.hash(token, 12);

  // Token expires 30 days after creation, or 30 days after event end date, whichever is later
  const baseExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const eventEndExpiry = endDate ? endDate.getTime() + 30 * 24 * 60 * 60 * 1000 : 0;
  const expires = new Date(Math.max(baseExpiry, eventEndExpiry));

  await db.eventEditToken.create({
    data: {
      eventId,
      tokenHash,
      expires,
    },
  });

  return token;
}

export async function validateEventEditToken(
  eventId: string,
  token: string
): Promise<boolean> {
  try {
    if (!token) {
      logger.debug("[eventEditToken] No token provided", { eventId });
      return false;
    }

    const records = await db.eventEditToken.findMany({
      where: { eventId },
      select: { tokenHash: true, expires: true },
    });

    if (records.length === 0) {
      logger.debug("[eventEditToken] No tokens found for event", { eventId });
      return false;
    }

    const now = new Date();

    for (const rec of records) {
      try {
        const match = await bcrypt.compare(token, rec.tokenHash);
        if (match && rec.expires > now) {
          logger.debug("[eventEditToken] Valid token found", { eventId });
          return true;
        }
      } catch (compareError) {
        logger.error("[eventEditToken] Error comparing token", compareError, { eventId });
        // Continue checking other tokens
      }
    }

    logger.debug("[eventEditToken] No valid token found", { eventId });
    return false;
  } catch (error) {
    logger.error("[eventEditToken] Validation error", error, { eventId });
    return false;
  }
}
