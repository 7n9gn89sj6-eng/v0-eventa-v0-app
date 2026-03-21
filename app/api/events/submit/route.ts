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
import {
  buildSubmitPlaceResolveInput,
  mergeSubmitLocationAfterResolve,
} from "@/lib/events/submit-place-resolution";
import { resolvePlace } from "@/lib/search/resolve-place";

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

    /* ------------------------- LOCATION PARSING + PLACE RESOLVE ------------------------- */

    const fallbackCity = validated.location?.city?.trim() || "Unknown";
    const fallbackState = validated.location?.state?.trim() || null;
    const fallbackCountry = validated.location?.country?.trim() || "Australia";
    const postcode = validated.location?.postcode?.trim() || null;

    let address = validated.location?.address ?? "";
    if (!address && validated.location) {
      const parts: string[] = [];
      if (validated.location.name) parts.push(validated.location.name);
      if (fallbackCity && fallbackCity !== "Unknown") parts.push(fallbackCity);
      if (fallbackState) parts.push(fallbackState);
      if (postcode) parts.push(postcode);
      if (fallbackCountry) parts.push(fallbackCountry);
      address = parts.join(", ");
    }

    /** Geocode query: full `location.address` if present (≥2 chars), else "city, state, country" (skips placeholder Unknown). */
    const placeResolveInput = buildSubmitPlaceResolveInput(validated.location);
    const resolvedPlace = placeResolveInput ? await resolvePlace(placeResolveInput) : null;
    const persistedLoc = mergeSubmitLocationAfterResolve({
      resolved: resolvedPlace,
      fallbackCity,
      fallbackCountry,
      fallbackState,
    });

    logger.info("[submit] place.resolve", {
      rawInput: placeResolveInput ?? null,
      resolved: resolvedPlace
        ? {
            city: resolvedPlace.city,
            country: resolvedPlace.country,
            region: resolvedPlace.region,
            parentCity: resolvedPlace.parentCity,
            lat: resolvedPlace.lat,
            lng: resolvedPlace.lng,
          }
        : null,
      persisted: {
        city: persistedLoc.city,
        country: persistedLoc.country,
        region: persistedLoc.region,
        parentCity: persistedLoc.parentCity,
        lat: persistedLoc.lat,
        lng: persistedLoc.lng,
        formattedAddress: persistedLoc.formattedAddress,
      },
    });

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
        city: persistedLoc.city,
        country: persistedLoc.country,
        postcode: postcode || null,
        region: persistedLoc.region,
        parentCity: persistedLoc.parentCity,
        formattedAddress: persistedLoc.formattedAddress,
        ...(persistedLoc.lat != null && persistedLoc.lng != null
          ? { lat: persistedLoc.lat, lng: persistedLoc.lng }
          : {}),

        imageUrl: validated.imageUrl || null,
        imageUrls,
        externalUrl: validated.externalUrl || null,

        categories,
        languages,
        ...(detectedLanguage ? { language: detectedLanguage } : {}), // Store detected language (only if detected)

        searchText: `${validated.title} ${validated.description} ${persistedLoc.city} ${persistedLoc.region ? persistedLoc.region + " " : ""}${postcode ? postcode + " " : ""}${persistedLoc.country}`.toLowerCase(),

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

    type ModerationOutcome = "approved" | "needs_review" | "rejected" | "moderation_failed" | "pending";
    let moderationOutcome: ModerationOutcome = "pending";
    let adminNotificationAttempted = false;
    let adminNotificationSent = false;

    try {
      const moderation = await moderateEvent({
        title: validated.title,
        description: validated.description,
        categories,
        languages,
        city: persistedLoc.city,
        country: persistedLoc.country,
      });

      console.log("[AI] moderation:", moderation);

      /* CASE 1 — APPROVED */
      if (moderation.approved) {
        moderationOutcome = "approved";
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
        moderationOutcome = "needs_review";
        await db.event.update({
          where: { id: event.id },
          data: {
            status: "PENDING",
            aiStatus: "NEEDS_REVIEW",
            aiReason: moderation.reason,
            aiAnalyzedAt: new Date(),
          },
        });

        adminNotificationAttempted = true;
        const notifyResult = await notifyAdminsEventNeedsReview({
          eventId: event.id,
          title: validated.title,
          city: persistedLoc.city,
          country: persistedLoc.country,
          aiStatus: "NEEDS_REVIEW",
          aiReason: moderation.reason,
        });
        adminNotificationSent = notifyResult.success === true;
        if (!adminNotificationSent) {
          logger.warn("[submit] Admin notification failed (event needs review)", {
            eventId: event.id,
            error: notifyResult.error,
          });
        }
      }

      /* CASE 3 — REJECTED */
      else {
        moderationOutcome = "rejected";
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
      moderationOutcome = "moderation_failed";
      logger.error("[submit] AI moderation failed completely", {
        eventId: event.id,
        error: err instanceof Error ? err.message : String(err),
      });

      // Harden: put event in visible review state so it is not stranded in silent limbo.
      // status=PENDING + aiStatus=NEEDS_REVIEW ensures it appears in admin "Needs Review" and "Pending" queues.
      await db.event.update({
        where: { id: event.id },
        data: {
          status: "PENDING",
          aiStatus: "NEEDS_REVIEW",
          aiReason: "Moderation service failed – manual review required",
          aiAnalyzedAt: new Date(),
        },
      });

      adminNotificationAttempted = true;
      const notifyResult = await notifyAdminsEventNeedsReview({
        eventId: event.id,
        title: validated.title,
        city: persistedLoc.city,
        country: persistedLoc.country,
        aiStatus: "NEEDS_REVIEW",
        aiReason: "Moderation service failed – manual review required",
      });
      adminNotificationSent = notifyResult.success === true;
      if (!adminNotificationSent) {
        logger.warn("[submit] Admin notification failed (moderation_failed)", {
          eventId: event.id,
          error: notifyResult.error,
        });
      }
    }

    /* ------------------------- SEND EDIT LINK EMAIL ------------------------- */

    let emailSent = false;
    let emailWarning: string | undefined;

    try {
      const token = await createEventEditToken(
        event.id,
        validated.end ?? validated.start
      );

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

      const emailResult = await sendEventEditLinkEmailAPI(
        validated.creatorEmail,
        validated.title,
        event.id,
        token,
        baseUrl
      );

      emailSent = emailResult.success === true;
      if (!emailResult.success) {
        emailWarning = "Your event was saved, but we could not send the edit email. You can request a new edit link from the event page.";
        console.error("[submit] Email send failed:", emailResult.error);
        logger.warn("[submit] Edit-link email failed", {
          eventId: event.id,
          recipient: validated.creatorEmail,
          error: emailResult.error,
        });
      } else {
        console.log("[submit] Email sent successfully:", {
          messageId: emailResult.result?.data?.id,
          recipient: validated.creatorEmail,
        });
      }
    } catch (err) {
      emailWarning = "Your event was saved, but we could not send the edit email. You can request a new edit link from the event page.";
      console.error("[submit] Email error:", err);
      logger.warn("[submit] Edit-link email error", {
        eventId: event.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    /* ------------------------- RESPONSE ------------------------- */

    const payload = {
      ok: true,
      eventId: event.id,
      message: "Event submitted successfully",
      eventSaved: true,
      moderationOutcome,
      emailSent,
      ...(emailWarning && { emailWarning }),
      ...((moderationOutcome === "needs_review" || moderationOutcome === "moderation_failed") && {
        adminNotification: {
          attempted: adminNotificationAttempted,
          sent: adminNotificationSent,
        },
      }),
    };

    return NextResponse.json(payload);

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
