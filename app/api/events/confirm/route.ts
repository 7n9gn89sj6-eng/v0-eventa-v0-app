import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    console.log("[confirm] No token provided");
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;
  if (!NEON_DATABASE_URL) {
    console.error("[confirm] Missing NEON_DATABASE_URL");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const sql = neon(NEON_DATABASE_URL);

  try {
    // Get non-expired tokens
    const rows = await sql`
      SELECT 
        "EventEditToken".id,
        "EventEditToken"."eventId",
        "EventEditToken"."tokenHash",
        "Event".status
      FROM "EventEditToken"
      JOIN "Event" ON "EventEditToken"."eventId" = "Event".id
      WHERE "EventEditToken".expires > NOW()
    `;

    let matchedRecord: any = null;

    for (const row of rows) {
      const matches = await bcrypt.compare(token, row.tokenHash);
      if (matches) {
        matchedRecord = row;
        break;
      }
    }

    if (!matchedRecord) {
      console.log("[confirm] Token does not match any record");
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Publish event
    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED', "updatedAt" = NOW()
      WHERE id = ${matchedRecord.eventId}
    `;

    console.log("[confirm] Event published:", matchedRecord.eventId);

    return NextResponse.json({
      ok: true,
      eventId: matchedRecord.eventId,
    });
  } catch (err) {
    console.error("[confirm] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
