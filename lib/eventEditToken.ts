import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export async function createEventEditToken(eventId: string): Promise<string> {
  const token = randomUUID();
  const tokenHash = await bcrypt.hash(token, 12);

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
