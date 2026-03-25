import { NextResponse } from "next/server"
import {
  parseCreatorEmailForCreateSimple,
  resolveCreateSimpleCategoryAndLabel,
} from "@/lib/events/create-simple-transform"

export const runtime = "nodejs"

// ALIAS endpoint that transforms AI extraction data and internally calls the canonical /api/events/submit handler
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>

    console.log("[v0] Create-simple ALIAS: Received payload, transforming to canonical schema")

    const creatorParsed = parseCreatorEmailForCreateSimple(body.creatorEmail)
    if (!creatorParsed.ok) {
      return NextResponse.json(
        { error: "Valid creator email is required (sign in, or enter your email for the edit link)." },
        { status: 400 },
      )
    }

    const { category: resolvedCategory, customCategoryLabel: resolvedCustomLabel } =
      resolveCreateSimpleCategoryAndLabel(body)

    /**
     * When category is explicit (not forced OTHER), preserve prior behavior: only attach import-style
     * custom label when the client sent nothing and we fell through to empty category — already handled
     * inside resolveCreateSimpleCategoryAndLabel. For explicit OTHER from unresolved, resolvedCustomLabel is set.
     */
    const imageUrlTrimmed =
      typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : undefined
    const externalUrlTrimmed =
      typeof body.externalUrl === "string" && body.externalUrl.trim() ? body.externalUrl.trim() : undefined

    const canonicalPayload = {
      title: body.title || (body.extraction as Record<string, unknown> | undefined)?.title,
      description: body.description || String((body.extraction as Record<string, unknown> | undefined)?.description ?? "") || "",
      start: body.start || (body.extraction as Record<string, unknown> | undefined)?.start,
      end: body.end || (body.extraction as Record<string, unknown> | undefined)?.end,
      timezone: body.timezone || (body.extraction as Record<string, unknown> | undefined)?.timezone,
      location: body.location || (body.extraction as Record<string, unknown> | undefined)?.location,
      category: resolvedCategory,
      tags: body.tags ?? (body.extraction as Record<string, unknown> | undefined)?.tags,
      customCategoryLabel: resolvedCustomLabel,
      originalLanguage: body.originalLanguage ?? null,
      price: body.price || (body.extraction as Record<string, unknown> | undefined)?.price,
      organizer_name: body.organizer_name || (body.extraction as Record<string, unknown> | undefined)?.organizer_name,
      organizer_contact: body.organizer_contact || body.contactInfo,
      source_text: body.source_text || body.sourceText,
      imageUrl: imageUrlTrimmed,
      externalUrl: externalUrlTrimmed,
      extractionConfidence: body.extractionConfidence || (body.extraction as Record<string, unknown> | undefined)?.confidence,
      creatorEmail: creatorParsed.email,
    }

    console.log("[v0] Create-simple ALIAS: Calling canonical /api/events/submit")

    const submitRequest = new Request(new URL("/api/events/submit", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(canonicalPayload),
    })

    // Import and call the canonical handler
    const { POST: canonicalHandler } = await import("../submit/route")
    const response = await canonicalHandler(submitRequest as any)

    // Return the same response structure
    const result = await response.json()

    console.log("[v0] Create-simple ALIAS: Canonical handler returned", result)

    if (result.ok) {
      return NextResponse.json({
        success: true,
        eventId: result.eventId,
        emailedEditLink: result.emailSent,
      })
    } else {
      return NextResponse.json(result, { status: response.status })
    }
  } catch (error) {
    console.error("[v0] Create-simple ALIAS: Error:", error)
    return NextResponse.json(
      {
        error: "Failed to create event. Please try again.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
