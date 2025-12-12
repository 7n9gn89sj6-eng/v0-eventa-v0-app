import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

/* -------------------------------------------------------------------------- */
/*  Create a new event edit token                                             */
/* -------------------------------------------------------------------------- */
export async function createEventEditToken(eventId: string): Promise<string> {
  const token = randomUUID();
  const tokenHash = await bcrypt.hash(token, 12);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.eventEditToken.create({
    data: {
      eventId,
      tokenHash,
      expires: expiresAt,
    },
  });

  return token;
}

/* -------------------------------------------------------------------------- */
/*  Validate an event edit token                                              */
/* -------------------------------------------------------------------------- */
export async function validateEventEditToken(
  eventId: string,
  token: string
): Promise<boolean> {
  try {
    if (!token || token.trim() === "") return false;

    const records = await db.eventEditToken.findMany({
      where: { eventId },
      select: { tokenHash: true, expires: true },
    });

    if (records.length === 0) return false;

    const now = new Date();

    for (const rec of records) {
      const match = await bcrypt.compare(token, rec.tokenHash);
      if (!match) continue;

      if (rec.expires <= now) return false;

      return true;
    }

    return false;
  } catch (err) {
    console.error("TOKEN VALIDATION ERROR:", err);
    return false;
  }
}
