import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { detectEventLanguage } from "@/lib/search/language-detection-enhanced";
import { generateEventEmbedding, shouldSkipEmbedding } from "@/lib/embeddings/generate";
import { storeEventEmbedding } from "@/lib/embeddings/store";
import {
  parseEventCategoryPayload,
  SEARCH_SLUG_BY_CATEGORY,
} from "@/lib/categories/canonical-event-category";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handleUpdate(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
  const eventId = params.id;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing edit token" },
      { status: 401 }
    );
  }

  const valid = await validateEventEditToken(eventId, token);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 403 }
    );
  }

  const body = await req.json();

  // Token-authenticated soft withdraw only — no other status/moderation changes via this route.
  if (body?.withdraw === true) {
    try {
      const existing = await db.event.findUnique({
        where: { id: eventId },
        select: { id: true, status: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      if (existing.status === "ARCHIVED") {
        return NextResponse.json({ success: true, withdrawn: true });
      }
      await db.event.update({
        where: { id: eventId },
        data: { status: "ARCHIVED" },
      });
      return NextResponse.json({ success: true, withdrawn: true });
    } catch (error) {
      console.error("[events/withdraw] Error:", error);
      return NextResponse.json(
        { error: "Failed to remove listing" },
        { status: 500 }
      );
    }
  }

  const {
    title,
    description,
    locationAddress,
    city,
    state,
    country,
    postcode,
    startAt,
    endAt,
    imageUrl,
    externalUrl,
    category,
    subcategory,
    tags,
    customCategoryLabel,
    originalLanguage,
  } = body;

  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch current event to check if title/description changed
    const currentEvent = await db.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        description: true,
        categories: true,
        venueName: true,
        category: true,
        subcategory: true,
        tags: true,
        customCategoryLabel: true,
        originalLanguage: true,
      },
    });

    if (!currentEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Check if title or description changed
    const titleChanged = currentEvent.title !== title;
    const descriptionChanged = currentEvent.description !== (description || "");
    const shouldRegenerate = titleChanged || descriptionChanged;

    // Detect language from updated title + description (non-blocking)
    let detectedLanguage: string | null = null;
    if (shouldRegenerate) {
      console.log("[events/update] Title or description changed, detecting language", {
        eventId,
        titleChanged,
        descriptionChanged,
        titlePreview: title.substring(0, 50),
      });

      detectedLanguage = await detectEventLanguage(title, description || null).catch((error) => {
        console.warn("[events/update] Language detection failed", { eventId, error });
        return null;
      });

      console.log("[events/update] Language detection result", {
        eventId,
        detectedLanguage,
        titlePreview: title.substring(0, 50),
      });
    }

    // Build update data object with all provided fields
    const updateData: Record<string, unknown> = {
      title,
      description: description || "",
      ...(shouldRegenerate && detectedLanguage !== null ? { language: detectedLanguage } : {}),
    };

    const categoryTouched =
      category !== undefined ||
      subcategory !== undefined ||
      tags !== undefined ||
      customCategoryLabel !== undefined ||
      originalLanguage !== undefined;

    if (categoryTouched && currentEvent) {
      try {
        const merged = {
          category:
            category !== undefined && category !== null && String(category).trim() !== ""
              ? String(category)
              : String(currentEvent.category ?? ""),
          subcategory: subcategory !== undefined ? subcategory : currentEvent.subcategory,
          tags: tags !== undefined ? tags : currentEvent.tags,
          customCategoryLabel:
            customCategoryLabel !== undefined
              ? customCategoryLabel
              : currentEvent.customCategoryLabel,
          originalLanguage:
            originalLanguage !== undefined ? originalLanguage : currentEvent.originalLanguage,
        };
        const parsed = parseEventCategoryPayload(merged);
        Object.assign(updateData, {
          category: parsed.category,
          subcategory: parsed.subcategory,
          tags: parsed.tags,
          customCategoryLabel: parsed.customCategoryLabel,
          originalLanguage: parsed.originalLanguage,
          categories: [SEARCH_SLUG_BY_CATEGORY[parsed.category]],
        });
      } catch (e) {
        if (e instanceof z.ZodError) {
          return NextResponse.json({ error: "Validation failed", issues: e.issues }, { status: 400 });
        }
        throw e;
      }
    }

    // Update location fields if provided (Prisma uses `region`, not `state`)
    if (locationAddress !== undefined) updateData.address = locationAddress;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.region = state;
    if (country !== undefined) updateData.country = country;
    if (postcode !== undefined) updateData.postcode = postcode;

    // Update dates if provided - parse as Date objects (Prisma expects Date, not ISO string)
    if (startAt) updateData.startAt = new Date(startAt);
    if (endAt) updateData.endAt = new Date(endAt);

    // Update URLs if provided — keep `imageUrl` and `imageUrls` aligned for listings
    if (imageUrl !== undefined) {
      const trimmed = typeof imageUrl === "string" ? imageUrl.trim() : "";
      updateData.imageUrl = trimmed || null;
      updateData.imageUrls = trimmed ? [trimmed] : [];
    }
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl || null;

    const event = await db.event.update({
      where: { id: eventId },
      data: updateData as any,
    });

    // Regenerate embedding if title/description changed (async, non-blocking)
    if (shouldRegenerate && !shouldSkipEmbedding()) {
      console.log("[events/update] Regenerating embedding", {
        eventId,
        titlePreview: title.substring(0, 50),
      });

      generateEventEmbedding(
        title,
        description || null,
        currentEvent.venueName || null,
        currentEvent.categories || []
      )
        .then(async (embedding) => {
          if (embedding) {
            console.log("[events/update] Embedding generated, storing", { eventId });
            await storeEventEmbedding(eventId, embedding).catch((error) => {
              console.warn(`[events/update] Failed to store embedding for event ${eventId}:`, error);
            });
          } else {
            console.warn("[events/update] Embedding generation returned null", { eventId });
          }
        })
        .catch((error) => {
          console.warn(`[events/update] Embedding generation failed for event ${eventId}:`, error);
          // Embedding is optional, don't fail event update
        });
    }

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("[events/update] Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, ctx);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, ctx);
}
