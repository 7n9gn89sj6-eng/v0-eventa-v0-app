import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;
  if (!NEON_DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }

  const sql = neon(NEON_DATABASE_URL);

  try {
    // Fetch valid tokens
    const tokens = await sql`
      SELECT 
        tet.id,
        tet."eventId",
        tet."tokenHash",
        e.title
      FROM "EventEditToken" tet
      JOIN "Event" e ON tet."eventId" = e.id
      WHERE tet.expires > NOW()
    `;

    let matched = null;

    for (const row of tokens) {
      const match = await bcrypt.compare(token, row.tokenHash);
      if (match) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      return NextResponse.json({ ok: false, error: "Invalid or expired token" }, { status: 400 });
    }

    // Publish event
    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED', "updatedAt" = NOW()
      WHERE id = ${matched.eventId}
    `;

    console.log("[confirm] Event published:", matched.eventId);

    // TODO: send event content to AI moderator + admin  
    // (you told me this comes after confirmation — I will wire it next)

    return NextResponse.json({
      ok: true,
      eventId: matched.eventId,
      title: matched.title,
    });
  } catch (err) {
    console.error("[confirm] Error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
