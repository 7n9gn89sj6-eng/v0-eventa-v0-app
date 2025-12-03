import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { moderateEvent } from "@/lib/ai-moderation";
import { notifyAdminsEventNeedsReview } from "@/lib/admin-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  console.log("[AI] /api/moderation/run CALLED");

  try {
    const sql = neon(process.env.NEON_DATABASE_URL!);

    const [event] = await sql`
      SELECT *
      FROM "Event"
      WHERE "aiStatus" = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;

    if (!event) {
      return NextResponse.json({
        ok: true,
        message: "No events waiting for moderation",
      });
    }

    console.log("[AI] Moderating event:", event.id);

    const moderation = await moderateEvent({
      title: event.title,
      description: event.description,
      categories: event.categories,
      languages: event.languages,
      city: event.city,
      country: event.country,
    });

    /* ------------------------- UPDATE DB BASED ON RESULT ------------------------- */

    if (moderation.approved === true) {
      await sql`
        UPDATE "Event"
        SET status = 'PUBLISHED',
            "aiStatus" = 'APPROVED',
            "updatedAt" = NOW()
        WHERE id = ${event.id}
      `;
      console.log("[AI] Approved:", event.id);
    }

    else if (moderation.needsReview === true) {
      await sql`
        UPDATE "Event"
        SET status = 'PENDING_REVIEW',
            "aiStatus" = 'NEEDS_REVIEW',
            "updatedAt" = NOW()
        WHERE id = ${event.id}
      `;
      console.log("[AI] Needs Review:", event.id);

      await notifyAdminsEventNeedsReview({
        eventId: event.id,
        title: event.title,
        city: event.city,
        country: event.country,
        aiStatus: "NEEDS_REVIEW",
        aiReason: moderation.reason,
      });
    }

    else {
      await sql`
        UPDATE "Event"
        SET status = 'REJECTED',
            "aiStatus" = 'REJECTED',
            "updatedAt" = NOW()
        WHERE id = ${event.id}
      `;
      console.log("[AI] Rejected:", event.id, moderation.reason);
    }

    /* ------------------------- RESPONSE ------------------------- */

    return NextResponse.json({
      ok: true,
      moderatedEvent: event.id,
    });

  } catch (err) {
    console.error("[AI] Moderation error:", err);
    return NextResponse.json(
      { ok: false, error: "Moderation failed" },
      { status: 500 }
    );
  }
}
