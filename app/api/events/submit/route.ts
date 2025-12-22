import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { createEventEditToken } from "@/lib/eventEditToken";
import { sendEventEditLinkEmailAPI } from "@/lib/email";
import { moderateEvent } from "@/lib/ai-moderation";
import { detectEventLanguage } from "@/lib/search/language-detection-enhanced";
import { generateEventEmbedding, shouldSkipEmbedding } from "@/lib/embeddings/generate";
import { storeEventEmbedding } from "@/lib/embeddings/store";
import { notifyAdminsEventNeedsReview } from "@/lib/admin-notifications";
import { checkRateLimit, getClientIdentifier, rateLimiters } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

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
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postcode: z.string().optional(),
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
    // Check rate limit
    const clientId = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(clientId, rateLimiters.submit);
    
    if (!rateLimitResult.success) {
      logger.warn("[submit] Rate limit exceeded", {
        clientId,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
      });
      return NextResponse.json(
        { error: `Rate limit exceeded. Please try again in ${rateLimitResult.reset ? Math.ceil((rateLimitResult.reset - Date.now()) / 1000) : 'a few'} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    logger.debug("[submit] Incoming request", { clientId });

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

    // Use individual fields if provided, otherwise parse from address string
    const city = validated.location?.city || "Unknown";
    const state = validated.location?.state || null;
    const country = validated.location?.country || "Australia";
    const postcode = validated.location?.postcode || null;
    
    // Build address string if individual components are provided
    let address = validated.location?.address ?? "";
    if (!address && validated.location) {
      // Construct address from components
      const parts: string[] = []
      if (validated.location.name) parts.push(validated.location.name)
      if (city && city !== "Unknown") parts.push(city)
      if (state) parts.push(state)
      if (postcode) parts.push(postcode)
      if (country) parts.push(country)
      address = parts.join(", ")
    }

    /* ------------------------- DETECT LANGUAGE ------------------------- */
    
    logger.info("[submit] Starting language detection", { titlePreview: validated.title.substring(0, 50) });
    // Detect language from title + description (non-blocking)
    const detectedLanguage = await detectEventLanguage(
      validated.title,
      validated.description || null
    ).catch((error) => {
      logger.warn("[submit] Language detection failed", error);
      return null;
    });
    logger.info("[submit] Language detection result", { detectedLanguage, titlePreview: validated.title.substring(0, 50) });

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
        postcode: postcode || null,

        imageUrl: validated.imageUrl || null,
        imageUrls,
        externalUrl: validated.externalUrl || null,

        categories,
        languages,
        ...(detectedLanguage ? { language: detectedLanguage } : {}), // Store detected language (only if detected)

        searchText: `${validated.title} ${validated.description} ${city} ${state ? state + " " : ""}${postcode ? postcode + " " : ""}${country}`.toLowerCase(),

        createdById: user.id,

        // Initial status before AI
        status: "DRAFT",
        aiStatus: "PENDING",
      },
    });

    console.log("[submit] Event created:", event.id);

    /* ------------------------- GENERATE EMBEDDING (async, non-blocking) ------------------------- */
    
    if (!shouldSkipEmbedding()) {
      logger.info("[submit] Starting embedding generation", { eventId: event.id, titlePreview: validated.title.substring(0, 50) });
      generateEventEmbedding(
        validated.title,
        validated.description || null,
        validated.location?.name || null,
        categories || []
      )
        .then(async (embedding) => {
          if (embedding) {
            logger.info("[submit] Embedding generated, storing", { eventId: event.id });
            await storeEventEmbedding(event.id, embedding).catch((error) => {
              logger.warn(`[submit] Failed to store embedding for event ${event.id}`, error);
            });
          } else {
            logger.warn("[submit] Embedding generation returned null", { eventId: event.id });
          }
        })
        .catch((error) => {
          logger.warn(`[submit] Embedding generation failed for event ${event.id}`, error);
          // Embedding is optional, don't fail event creation
        });
    } else {
      logger.info("[submit] Embedding generation skipped (SKIP_EMBEDDING_GENERATION=true)");
    }

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
            moderationStatus: "APPROVED", // Required for PUBLIC_EVENT_WHERE filter in search
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
      // Log the error but don't block event creation
      // Event will remain in DRAFT/PENDING state until manually reviewed
      logger.error("[submit] AI moderation failed completely", {
        eventId: event.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    /* ------------------------- SEND EDIT LINK EMAIL ------------------------- */

    try {
      const token = await createEventEditToken(
        event.id,
        validated.end ?? validated.start
      );

      const emailResult = await sendEventEditLinkEmailAPI(
        validated.creatorEmail,
        validated.title,
        event.id,
        token
      );

      if (!emailResult.success) {
        console.error("[submit] Email send failed:", emailResult.error);
        console.error("[submit] Email config check:", {
          RESEND_API_KEY: process.env.RESEND_API_KEY ? "SET" : "NOT SET",
          EMAIL_FROM: process.env.EMAIL_FROM,
          recipient: validated.creatorEmail,
        });
      } else {
        console.log("[submit] Email sent successfully:", {
          messageId: emailResult.result?.data?.id,
          recipient: validated.creatorEmail,
        });
      }
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
