import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { createAuditLog } from "@/lib/audit-log";

/* -------------------------------------------------------------------------- */
/*  Create a new event edit token                                             */
/* -------------------------------------------------------------------------- */
export async function createEventEditToken(eventId: string): Promise<string> {
  const token = randomUUID();
  const tokenHash = await bcrypt.hash(token, 12);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  try {
    await db.eventEditToken.create({
      data: {
        eventId,
        tokenHash,
        expires: expiresAt,
      },
    });

    console.log("[edit-token] Created token", {
      eventId,
      expires: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[edit-token] FAILED to create token", err);
    throw err;
  }

  return token;
}

/* -------------------------------------------------------------------------- */
/*  Validate a token (returns: ok | invalid | expired)                         */
/* -------------------------------------------------------------------------- */
export async function validateEventEditToken(
  eventId: string,
  token: string
): Promise<"ok" | "invalid" | "expired"> {
  if (!token || token.trim() === "") return "invalid";

  // Fetch all existing tokens for this event
  const records = await db.eventEditToken.findMany({
    where: { eventId },
    select: {
      id: true,
      tokenHash: true,
      expires: true,
      usedAt: true,
    },
  });

  // If none exist → do NOT reveal that fact: return invalid
  if (records.length === 0) {
    await createAuditLog({
      eventId,
      action: "EDIT_TOKEN_INVALID",
      details: "No edit tokens exist for this event",
      metadata: { tokenPrefix: token.slice(0, 8) },
    });

    return "invalid";
  }

  const now = new Date();

  /* ---------------------------------------------------------------------- */
  /*  Try all tokens (bcrypt-compare constant-time)                         */
  /* ---------------------------------------------------------------------- */
  for (const rec of records) {
    const isMatch = await bcrypt.compare(token, rec.tokenHash);

    if (!isMatch) continue;

    // Matched a token hash → now check expiry
    if (rec.expires <= now) {
      await createAuditLog({
        eventId,
        action: "EDIT_TOKEN_EXPIRED",
        details: "Matched hash but token expired",
        metadata: {
          expiredAt: rec.expires.toISOString(),
          attemptedAt: now.toISOString(),
          tokenPrefix: token.slice(0, 8),
        },
      });

      return "expired";
    }

    // OPTIONAL: One-time token invalidation (disabled for now)
    // await db.eventEditToken.update({
    //   where: { id: rec.id },
    //   data: { usedAt: now },
    // });

    await createAuditLog({
      eventId,
      action: "EDIT_TOKEN_OK",
      details: "Token validated successfully",
      metadata: { tokenPrefix: token.slice(0, 8) },
    });

    return "ok";
  }

  /* ---------------------------------------------------------------------- */
  /*  No matching hash found → invalid                                      */
  /* ---------------------------------------------------------------------- */
  await createAuditLog({
    eventId,
    action: "EDIT_TOKEN_INVALID",
    details: "Provided token does not match any stored hashes",
    metadata: { tokenPrefix: token.slice(0, 8) },
  });

  return "invalid";
}
