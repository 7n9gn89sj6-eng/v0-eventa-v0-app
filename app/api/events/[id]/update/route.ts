import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { detectEventLanguage } from "@/lib/search/language-detection-enhanced";
import { generateEventEmbedding, shouldSkipEmbedding } from "@/lib/embeddings/generate";
import { storeEventEmbedding } from "@/lib/embeddings/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const formData = await req.formData();

  const token = formData.get("token")?.toString();
  const title = formData.get("title")?.toString();
  const description = formData.get("description")?.toString();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const valid = await validateEventEditToken(id, token);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 403 }
    );
  }

  // Fetch current event to check if title/description changed
  const currentEvent = await db.event.findUnique({
    where: { id },
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
      eventId: id,
      titleChanged,
      descriptionChanged,
      titlePreview: title?.substring(0, 50),
    });

    detectedLanguage = await detectEventLanguage(title || "", description || null).catch((error) => {
      console.warn("[events/update] Language detection failed", { eventId: id, error });
      return null;
    });

    console.log("[events/update] Language detection result", {
      eventId: id,
      detectedLanguage,
      titlePreview: title?.substring(0, 50),
    });
  }

  // Update event with new title/description and detected language
  await db.event.update({
    where: { id },
    data: {
      title,
      description,
      ...(shouldRegenerate && detectedLanguage !== null ? { language: detectedLanguage } : {}),
    },
  });

  // Regenerate embedding if title/description changed (async, non-blocking)
  if (shouldRegenerate && !shouldSkipEmbedding() && title) {
    console.log("[events/update] Regenerating embedding", {
      eventId: id,
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
          console.log("[events/update] Embedding generated, storing", { eventId: id });
          await storeEventEmbedding(id, embedding).catch((error) => {
            console.warn(`[events/update] Failed to store embedding for event ${id}:`, error);
          });
        } else {
          console.warn("[events/update] Embedding generation returned null", { eventId: id });
        }
      })
      .catch((error) => {
        console.warn(`[events/update] Embedding generation failed for event ${id}:`, error);
        // Embedding is optional, don't fail event update
      });
  }

  // ✅ IMPORTANT: return HTML redirect, not NextResponse.redirect
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/events/${id}`,
    },
  });
}
