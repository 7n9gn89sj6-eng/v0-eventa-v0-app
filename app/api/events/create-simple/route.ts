import { NextResponse } from "next/server"

export const runtime = "nodejs"

// ALIAS endpoint that transforms AI extraction data and internally calls the canonical /api/events/submit handler
export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log("[v0] Create-simple ALIAS: Received payload, transforming to canonical schema")

    const canonicalPayload = {
      title: body.title || body.extraction?.title,
      description: body.description || body.extraction?.description || "",
      start: body.start || body.extraction?.start,
      end: body.end || body.extraction?.end,
      timezone: body.timezone || body.extraction?.timezone,
      location: body.location || body.extraction?.location,
      category: body.category !== "auto" ? body.category : body.extraction?.category,
      price: body.price || body.extraction?.price,
      organizer_name: body.organizer_name || body.extraction?.organizer_name,
      organizer_contact: body.organizer_contact || body.contactInfo,
      source_text: body.source_text || body.sourceText,
      imageUrl: body.imageUrl,
      externalUrl: body.externalUrl,
      tags: body.tags || body.extraction?.tags,
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
