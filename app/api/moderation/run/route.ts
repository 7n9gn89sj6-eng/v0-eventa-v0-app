import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { moderateEvent } from "@/lib/ai-moderation";
import { notifyAdminsEventNeedsReview } from "@/lib/admin-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sql = neon(process.env.NEON_DATABASE_URL!);

    const [event] = await sql`
      SELECT *
      FROM "Event"
      WHERE "aiStatus" = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT 1;
    `;

    if (!event) {
      return NextResponse.json({
        ok: true,
        message: "No events waiting for moderation",
      });
    }

    const moderation = await moderateEvent({
      title: event.title,
      description: event.description,
      categories: event.categories,
      languages: event.languages,
      city: event.city,
      country: event.country,
    });

    /* APPROVE */
    if (moderation.approved === true) {
      await sql`
        UPDATE "Event"
        SET status = 'PUBLISHED',
            "aiStatus" = 'SAFE',
            "moderationStatus" = 'APPROVED',
            "aiReason" = ${moderation.reason},
            "aiAnalyzedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = ${event.id};
      `;
    }
    /* NEEDS REVIEW */
    else if (moderation.needsReview === true) {
      await sql`
        UPDATE "Event"
        SET status = 'PENDING',
            "aiStatus" = 'NEEDS_REVIEW',
            "aiReason" = ${moderation.reason},
            "aiAnalyzedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = ${event.id};
      `;

      await notifyAdminsEventNeedsReview({
        eventId: event.id,
        title: event.title,
        city: event.city,
        country: event.country,
        aiStatus: "NEEDS_REVIEW",
        aiReason: moderation.reason,
      });
    }
    /* REJECT */
    else {
      await sql`
        UPDATE "Event"
        SET status = 'DRAFT',
            "aiStatus" = 'REJECTED',
            "aiReason" = ${moderation.reason},
            "aiAnalyzedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = ${event.id};
      `;
    }

    return NextResponse.json({
      ok: true,
      moderatedEvent: event.id,
    });
  } catch (err) {
    console.error("[AI Moderation Error]", err);
    return NextResponse.json(
      { ok: false, error: "Moderation failed" },
      { status: 500 }
    );
  }
}

