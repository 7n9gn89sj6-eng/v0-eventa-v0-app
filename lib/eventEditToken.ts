export async function validateEventEditToken(
  eventId: string,
  token: string
): Promise<boolean> {
  try {
    if (!token || token.trim() === "") return false;

    // Fetch all tokens for this event
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
