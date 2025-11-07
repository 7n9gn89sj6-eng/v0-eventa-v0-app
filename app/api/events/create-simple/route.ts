import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { moderateEventContent } from "@/lib/ai-moderation"
import { sendEventEditLinkEmail } from "@/lib/email"
import { createEventEditToken } from "@/lib/eventEditToken"
import { checkRateLimit } from "@/lib/rate-limit"
import type { EventExtractionOutput } from "@/lib/types"
import { createSearchTextFolded } from "@/lib/search/accent-fold"
import { notifyAdminOfFlaggedEvent } from "@/lib/admin-notifications"
import { sendEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const session = await auth()

    console.log("[v0] Create-simple: Auth check", { hasSession: !!session, email: session?.user?.email })

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rateLimitResult = await checkRateLimit(session.user.id, "event_submission", 5, 60 * 60 * 1000)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "You've reached your event creation limit. Try again soon.",
          resetAt: rateLimitResult.resetAt.toISOString(),
        },
        { status: 429 },
      )
    }

    const body = await req.json()
    const {
      sourceText,
      extraction,
      category,
      followUpAnswer,
      imageUrl,
      externalUrl,
      contactInfo,
    }: {
      sourceText: string
      extraction: EventExtractionOutput
      category: string
      followUpAnswer?: string
      imageUrl?: string
      externalUrl?: string
      contactInfo?: string
    } = body

    console.log("[v0] Create-simple: Request body", {
      hasSourceText: !!sourceText,
      hasExtraction: !!extraction,
      category,
    })

    if (!sourceText || !extraction) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Parse location from extraction
    const city = extraction.location?.name || extraction.location?.address || "Unknown"
    const country = "Australia" // Default, could be extracted from location

    const searchParts = [extraction.title, extraction.description, city, country]
    const searchText = searchParts.filter(Boolean).join(" ")
    const searchTextFolded = createSearchTextFolded(searchParts)

    console.log("[v0] Create-simple: Creating event in database")
    const event = await db.event.create({
      data: {
        title: extraction.title,
        description: extraction.description,
        startAt: new Date(extraction.start),
        endAt: extraction.end ? new Date(extraction.end) : new Date(extraction.start),
        venueName: extraction.location?.name || null,
        locationAddress: extraction.location?.address || null,
        city,
        country,
        lat: extraction.location?.lat || null,
        lng: extraction.location?.lng || null,
        timezone: extraction.timezone || "UTC",
        priceFree: extraction.price === "free",
        priceAmount: extraction.price === "paid" ? 0 : null,
        imageUrl: imageUrl || null,
        externalUrl: externalUrl || null,
        // Phase 3 fields
        sourceText,
        category:
          category !== "auto"
            ? (category as any)
            : extraction.category !== "auto"
              ? (extraction.category as any)
              : null,
        tags: extraction.tags || [],
        extractionConfidence: extraction.confidence as any,
        organizerName: extraction.organizer_name || null,
        organizerContact: contactInfo || extraction.organizer_contact || null,
        // Set status to DRAFT like legacy flow
        status: "DRAFT",
        moderationStatus: "PENDING",
        createdById: session.user.id,
        searchText,
        searchTextFolded,
        categories: [],
        languages: ["en"],
        imageUrls: imageUrl ? [imageUrl] : [],
      },
    })

    console.log("[v0] Create-simple: Event created", { eventId: event.id })

    await db.eventAuditLog.create({
      data: {
        eventId: event.id,
        actor: "user",
        actorId: session.user.id,
        action: "created",
        newStatus: "PENDING",
        notes: "Event created via AI-powered natural language interface",
      },
    })

    let emailedEditLink = false
    try {
      console.log(`[v0] Create-simple: Sending edit link email to ${session.user.email}`)
      const token = await createEventEditToken(event.id, event.endAt)
      console.log(`[v0] Create-simple: Edit token created: ${token.substring(0, 10)}...`)

      // Use the SAME email function as legacy flow
      await sendEventEditLinkEmail(session.user.email, event.title, event.id, token)
      emailedEditLink = true
      console.log(`[v0] Create-simple: ✓ Edit link email sent successfully`)
    } catch (emailError) {
      console.error("[v0] Create-simple: ✗ Failed to send edit link email:", emailError)
      console.error(
        "[v0] Create-simple: Error details:",
        emailError instanceof Error ? emailError.message : String(emailError),
      )
    }

    moderateEventContent({
      title: extraction.title,
      description: extraction.description,
      city,
      country,
      externalUrl: externalUrl || undefined,
    })
      .then(async (moderationResult) => {
        console.log("[v0] Create-simple: Moderation result:", moderationResult)

        const oldStatus = "PENDING"
        const newStatus = moderationResult.status.toUpperCase()

        await db.event.update({
          where: { id: event.id },
          data: {
            moderationStatus: newStatus as any,
            moderationReason: moderationResult.reason,
            moderationSeverity: moderationResult.severity_level.toUpperCase() as any,
            moderationCategory: moderationResult.policy_category,
            moderatedAt: new Date(),
          },
        })

        await db.eventAuditLog.create({
          data: {
            eventId: event.id,
            actor: "ai",
            action:
              moderationResult.status === "approved"
                ? "approved"
                : moderationResult.status === "rejected"
                  ? "rejected"
                  : "flagged",
            oldStatus,
            newStatus,
            reason: moderationResult.reason,
            notes: `AI moderation: ${moderationResult.policy_category} (${moderationResult.severity_level} severity)`,
          },
        })

        console.log(`[v0] Create-simple: Event ${event.id} moderation status: ${moderationResult.status}`)

        // Notify admin and user of flagged/rejected events
        if (moderationResult.status === "flagged" || moderationResult.status === "rejected") {
          await notifyAdminOfFlaggedEvent({
            id: event.id,
            title: extraction.title,
            description: extraction.description,
            moderationStatus: moderationResult.status.toUpperCase(),
            moderationReason: moderationResult.reason,
            moderationSeverity: moderationResult.severity_level.toUpperCase(),
            moderationCategory: moderationResult.policy_category,
          })

          if (moderationResult.status === "rejected") {
            try {
              await sendEmail({
                to: session.user.email!,
                subject: `Event Rejected: ${extraction.title}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">Event Rejected</h2>
                    
                    <p>Hello ${session.user.name || "there"},</p>
                    
                    <p>Unfortunately, your event submission has been rejected by our automated moderation system.</p>
                    
                    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">
                      <p style="margin: 0; font-weight: bold;">Event: ${extraction.title}</p>
                      <p style="margin: 8px 0 0 0;">Reason: ${moderationResult.reason}</p>
                      <p style="margin: 8px 0 0 0;">Category: ${moderationResult.policy_category}</p>
                    </div>
                    
                    <p>If you believe this decision was made in error, you can edit your event and resubmit it.</p>
                    
                    <p>Thank you for your understanding.</p>
                  </div>
                `,
              })
              console.log("[v0] Create-simple: Rejection email sent")
            } catch (emailError) {
              console.error("[v0] Create-simple: Failed to send rejection email:", emailError)
            }
          }
        }
      })
      .catch((error) => {
        console.error("[v0] Create-simple: Moderation failed:", error)
      })

    return NextResponse.json({
      success: true,
      eventId: event.id,
      emailedEditLink,
    })
  } catch (error) {
    console.error("[v0] Create-simple: Error creating event:", error)
    return NextResponse.json(
      {
        error: "Failed to create event. Please try again.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
