import { NextResponse } from "next/server"

export const runtime = "nodejs"

// ALIAS endpoint that transforms AI extraction data and internally calls the canonical /api/events/submit handler
export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log("[v0] Create-simple ALIAS: Received payload, transforming to canonical schema")

    const categoryRaw =
      body.category !== "auto" && body.category != null
        ? body.category
        : body.extraction?.category

    const trimmedCategory =
      categoryRaw != null && String(categoryRaw).trim() !== "" ? String(categoryRaw).trim() : ""

    /**
     * AI/import alias: if neither body nor extraction supplied a category, submit as OTHER with an
     * explicit label (never a fake arts_culture / ART default).
     */
    const IMPORT_CATEGORY_UNSPECIFIED = "Imported (category not specified)"
    const extraction = body.extraction as Record<string, unknown> | undefined
    const extractionLabel =
      typeof extraction?.customCategoryLabel === "string"
        ? extraction.customCategoryLabel.trim().slice(0, 40)
        : ""
    const bodyLabel =
      body.customCategoryLabel != null ? String(body.customCategoryLabel).trim().slice(0, 40) : ""
    const resolvedImportLabel = (bodyLabel || extractionLabel || IMPORT_CATEGORY_UNSPECIFIED).slice(
      0,
      40,
    )

    const canonicalPayload = {
      title: body.title || body.extraction?.title,
      description: body.description || body.extraction?.description || "",
      start: body.start || body.extraction?.start,
      end: body.end || body.extraction?.end,
      timezone: body.timezone || body.extraction?.timezone,
      location: body.location || body.extraction?.location,
      category: trimmedCategory || "OTHER",
      tags: body.tags ?? body.extraction?.tags,
      customCategoryLabel: trimmedCategory
        ? body.customCategoryLabel ?? null
        : resolvedImportLabel || IMPORT_CATEGORY_UNSPECIFIED,
      originalLanguage: body.originalLanguage ?? null,
      price: body.price || body.extraction?.price,
      organizer_name: body.organizer_name || body.extraction?.organizer_name,
      organizer_contact: body.organizer_contact || body.contactInfo,
      source_text: body.source_text || body.sourceText,
      imageUrl: body.imageUrl,
      externalUrl: body.externalUrl,
      extractionConfidence: body.extractionConfidence || body.extraction?.confidence,
      creatorEmail: body.creatorEmail,
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
