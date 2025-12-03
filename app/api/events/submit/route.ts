/* -------------------------------------------------------------
   EVENT SUBMISSION + AI MODERATION
------------------------------------------------------------- */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";
import { createEventEditToken } from "@/lib/eventEditToken";
import { sendEventEditLinkEmailAPI } from "@/lib/email";
import { moderateEvent } from "@/lib/ai-moderation";
import { notifyAdminsEventNeedsReview } from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ------------------------- VALIDATION ------------------------- */

const EventSubmitSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  start: z.coerce.date(),
  end: z.coerce.date().optional(),
  timezone: z.string().optional(),
  location: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  creatorEmail: z.string().email(),
  imageUrl: z.string().optional().or(z.literal("")),
  externalUrl: z.string().optional().or(z.literal("")),
  categories: z.array(z.string()).default([]),
  languages: z.array(z.string()).default(["en"])
}).refine(d => !d.end || d.end > d.start, {
  path: ["end"],
  message: "End must be after start",
});


/* ------------------------- ROUTE HANDLER ------------------------- */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[v0] Incoming body:", body);

    const validated = EventSubmitSchema.parse(body);

    const sql = neon(process.env.NEON_DATABASE_URL!);

    /* ------------------------- USER ENSURE ------------------------- */

    let userId: string;
    const existingUser = await sql`
      SELECT id FROM "User" WHERE email = ${validated.creatorEmail} LIMIT 1
    `;

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      userId = crypto.randomUUID();
      await sql`
        INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
        VALUES (${userId}, ${validated.creatorEmail}, ${validated.creatorEmail.split("@")[0]}, NOW(), NOW())
      `;
    }

    /* ------------------------- ADDRESS PARSE ------------------------- */

    const address = validated.location?.address ?? "";
    const parts = address.split(",").map(p => p.trim()).filter(Boolean);
    const city = parts[1] || parts[0] || "Unknown";
    const country = parts[parts.length - 1] || "Unknown";

    const eventId = crypto.randomUUID();
    const imageUrls = validated.imageUrl ? [validated.imageUrl] : [];
    const searchText = `${validated.title} ${validated.description} ${city} ${country}`.toLowerCase();

    /* ------------------------- INSERT EVENT (initial state) ------------------------- */

    await sql`
      INSERT INTO "Event" (
        id, title, description,
        "startAt", "endAt", timezone,
        "venueName", address, city, country,
        "imageUrl", "imageUrls", "externalUrl",
        categories, languages, "searchText",
        "createdById",
        status,
        "aiStatus",
        "createdAt", "updatedAt"
      )
      VALUES (
        ${eventId},
        ${validated.title},
        ${validated.description},
        ${validated.start.toISOString()},
        ${(validated.end ?? validated.start).toISOString()},
        ${validated.timezone || "UTC"},
        ${validated.location?.name || null},
        ${address || null},
        ${city}, ${country},
        ${validated.imageUrl || null},
        ${imageUrls},
        ${validated.externalUrl || null},
        ${validated.categories},
        ${validated.languages},
        ${searchText},
        ${userId},
        'DRAFT',
        'PENDING',
        NOW(), NOW()
      )
    `;

    console.log("[v0] Event created:", eventId);

    /* ------------------------- AI MODERATION ------------------------- */

    const moderation = await moderateEvent({
      title: validated.title,
      description: validated.description,
      categories: validated.categories,
      languages: validated.languages,
      city,
      country,
    });

    console.log("[AI] moderation result:", moderation);

    if (moderation.approved === true) {
      await sql`
        UPDATE "Event"
        SET status = 'PUBLISHED',
            "aiStatus" = 'APPROVED',
            "updatedAt" = NOW()
        WHERE id = ${eventId}
      `;
      console.log("[AI] Event automatically approved");
    }

    else if (moderation.needsReview === true) {
      await sql`
        UPDATE "Event"
        SET status = 'PENDING_REVIEW',
            "aiStatus" = 'NEEDS_REVIEW',
            "updatedAt" = NOW()
        WHERE id = ${eventId}
      `;

      console.log("[AI] Event flagged for admin review");

      await notifyAdminsEventNeedsReview({
        eventId,
        title: validated.title,
        city,
        country,
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
        WHERE id = ${eventId}
      `;
      console.log("[AI] Event rejected:", moderation.reason);
    }

    /* ------------------------- CONFIRMATION EMAIL ------------------------- */

    const token = await createEventEditToken(eventId, validated.end ?? validated.start);
    await sendEventEditLinkEmailAPI(validated.creatorEmail, validated.title, eventId, token);

    return NextResponse.json({
      ok: true,
      eventId,
      status: "submitted",
    });

  } catch (error) {
    console.error("[submit] ERROR:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
