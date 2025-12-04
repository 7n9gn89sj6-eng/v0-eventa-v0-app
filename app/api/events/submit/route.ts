import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createEventEditToken } from "@/lib/eventEditToken";
import { sendEventEditLinkEmailAPI } from "@/lib/email";
import { moderateEvent } from "@/lib/ai-moderation";
import { notifyAdminsEventNeedsReview } from "@/lib/admin-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------- VALIDATION ------------------------- */

const EventSubmitSchema = z
  .object({
    title: z.string().min(2),
    description: z.string().default(""),

    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    timezone: z.string().optional(),

    location: z
      .object({
        name: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),

    creatorEmail: z.string().email(),

    imageUrl: z.string().url().optional().or(z.literal("")),
    externalUrl: z.string().url().optional().or(z.literal("")),

    categories: z.array(z.string()).default([]),
    languages: z.array(z.string()).default(["en"]),
  })
  .refine((d) => !d.end || d.end > d.start, {
    path: ["end"],
    message: "End must be after start",
  });

/* ------------------------- ROUTE HANDLER ------------------------- */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[submit] Incoming body:", body);

    const validated = EventSubmitSchema.parse(body);

    const categories = validated.categories ?? [];
    const languages =
      validated.languages?.length > 0 ? validated.languages : ["en"];

    const imageUrls =
      validated.imageUrl?.trim() ? [validated.imageUrl] : [];

    /* ------------------------- USER HANDLING ------------------------- */

    let user = await db.user.findUnique({
      where: { email: validated.creatorEmail },
      select: { id: true },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email: validated.creatorEmail,
          name: validated.creatorEmail.split("@")[0],
        },
        select: { id: true },
      });
    }

    /* ------------------------- LOCATION PARSING ------------------------- */

    const address = validated.location?.address ?? "";
    const parts = address
      ? address.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    const city = parts[1] || parts[0] || "Unknown";
    const country = parts[parts.length - 1] || "Australia";

    /* ------------------------- CREATE EVENT ------------------------- */

    const event = await db.event.create({
      data: {
        title: validated.title,
        description: validated.description,
        startAt: validated.start,
        endAt: validated.end ?? validated.start,
        timezone: validated.timezone || "UTC",

        venueName: validated.location?.name || null,
        address,
        city,
        country,

        imageUrl: validated.imageUrl || null,
        imageUrls,
        externalUrl: validated.externalUrl || null,

        categories,
        languages,

        searchText: `${validated.title} ${validated.description} ${city} ${country}`.toLowerCase(),

        createdById: user.id,

        // Initial status before AI
        status: "DRAFT",
        aiStatus: "PENDING",
      },
    });

    console.log("[submit] Event created:", event.id);

    /* ------------------------- AI MODERATION ------------------------- */

    try {
      const moderation = await moderateEvent({
        title: validated.title,
        description: validated.description,
        categories,
        languages,
        city,
        country,
      });

      console.log("[AI] moderation:", moderation);

      /* CASE 1 — APPROVED */
      if (moderation.approved) {
        await db.event.update({
          where: { id: event.id },
          data: {
            status: "PUBLISHED",
            aiStatus: "SAFE",
            aiReason: moderation.reason,
            aiAnalyzedAt: new Date(),
          },
        });
      }

      /* CASE 2 — NEEDS REVIEW */
      else if (moderation.needsReview) {
        await db.event.update({
          where: { id: event.id },
          data: {
            status: "PENDING",
            aiStatus: "NEEDS_REVIEW",
            aiReason: moderation.reason,
            aiAnalyzedAt: new Date(),
          },
        });

        await notifyAdminsEventNeedsReview({
          eventId: event.id,
          title: validated.title,
          city,
          country,
          aiStatus: "NEEDS_REVIEW",
          aiReason: moderation.reason,
        });
      }

      /* CASE 3 — REJECTED */
      else {
        await db.event.update({
          where: { id: event.id },
          data: {
            status: "DRAFT",
            aiStatus: "REJECTED",
            aiReason: moderation.reason,
            aiAnalyzedAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.error("[AI] moderation error:", err);
    }

    /* ------------------------- SEND EDIT LINK EMAIL ------------------------- */

    try {
      const token = await createEventEditToken(
        event.id,
        validated.end ?? validated.start
      );

      await sendEventEditLinkEmailAPI(
        validated.creatorEmail,
        validated.title,
        event.id,
        token
      );
    } catch (err) {
      console.error("[submit] Email error:", err);
    }

    /* ------------------------- RESPONSE ------------------------- */

    return NextResponse.json({
      ok: true,
      eventId: event.id,
      message: "Event submitted successfully",
    });

  } catch (error) {
    console.error("[submit] ERROR:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
