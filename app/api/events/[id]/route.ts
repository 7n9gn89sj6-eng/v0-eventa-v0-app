import { NextResponse } from "next/server";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { detectEventLanguage } from "@/lib/search/language-detection-enhanced";
import { generateEventEmbedding, shouldSkipEmbedding } from "@/lib/embeddings/generate";
import { storeEventEmbedding } from "@/lib/embeddings/store";

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
  const { title, description } = body;

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
      select: { title: true, description: true, categories: true, venueName: true },
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

    // Update event with new title/description and detected language
    const event = await db.event.update({
      where: { id: eventId },
      data: {
        title,
        description: description || "",
        ...(shouldRegenerate && detectedLanguage !== null ? { language: detectedLanguage } : {}),
      },
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
