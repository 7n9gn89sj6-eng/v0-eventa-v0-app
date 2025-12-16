import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

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
  if (!token) return false;

  const records = await db.eventEditToken.findMany({
    where: { eventId },
    select: { tokenHash: true, expires: true },
  });

  const now = new Date();

  for (const rec of records) {
    const match = await bcrypt.compare(token, rec.tokenHash);
    if (match && rec.expires > now) return true;
  }

  return false;
}
