import "server-only"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { createSearchTextFolded } from "@/lib/search/accent-fold"
import { createEventEditToken } from "@/lib/eventEditToken"
import { sendEventEditLinkEmail } from "@/lib/email"
import { moderateEventContent } from "@/lib/ai-moderation"
import { notifyAdminOfFlaggedEvent } from "@/lib/admin-notifications"
import { sendEmail } from "@/lib/email"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

const EventSubmitSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  start: z.string(), // ISO
  end: z.string().optional(),
  timezone: z.string().optional(),
  location: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
  category: z.string().optional(),
  price: z.string().optional(),
  organizer_name: z.string().optional(),
  organizer_contact: z.string().optional(), // email or phone
  source_text: z.string().optional(),
  // must be present from either session or payload:
  creatorEmail: z.string().email().optional(),
  // Legacy fields for backward compatibility
  imageUrl: z.string().url().optional().or(z.literal("")),
  externalUrl: z.string().url().optional().or(z.literal("")),
  // Optional Phase 3 fields
  tags: z.array(z.string()).optional(),
  extractionConfidence: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("[v0] CANONICAL submit: Received event submission")

    const validatedData = EventSubmitSchema.parse(body)

    const creatorEmail = validatedData.creatorEmail
    if (!creatorEmail) {
      return NextResponse.json({ error: "Creator email is required" }, { status: 400 })
    }

    // Find or create user
    let user
    try {
      user = await db.user.findUnique({
        where: { email: creatorEmail },
      })
    } catch (dbError) {
      console.error("[v0] Database error - tables may not exist:", dbError)
      return NextResponse.json(
        {
          error: "Database not initialized. Please run the setup script first.",
        },
        { status: 500 },
      )
    }

    if (!user) {
      user = await db.user.create({
        data: {
          email: creatorEmail,
          name: validatedData.organizer_name || creatorEmail.split("@")[0],
          isVerified: false,
        },
      })
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, "event_submission", 5, 60 * 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. You can submit up to 5 events per hour.",
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 },
      )
    }

    const searchParts = [
      validatedData.title,
      validatedData.description,
      validatedData.location?.name,
      validatedData.location?.address,
    ].filter(Boolean)
    const searchText = searchParts.join(" ")
    const searchTextFolded = createSearchTextFolded(searchParts)

    const event = await db.event.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        startAt: new Date(validatedData.start),
        endAt: validatedData.end ? new Date(validatedData.end) : new Date(validatedData.start),
        timezone: validatedData.timezone || "UTC",
        venueName: validatedData.location?.name || null,
        locationAddress: validatedData.location?.address || null,
        lat: validatedData.location?.lat || null,
        lng: validatedData.location?.lng || null,
        city: validatedData.location?.address?.split(",")[0]?.trim() || "Unknown",
        country: "Australia", // Default, could be improved
        priceFree: validatedData.price === "free",
        priceAmount: validatedData.price === "paid" ? 0 : null,
        imageUrl: validatedData.imageUrl || null,
        externalUrl: validatedData.externalUrl || null,
        category: validatedData.category as any,
        tags: validatedData.tags || [],
        extractionConfidence: validatedData.extractionConfidence as any,
        organizerName: validatedData.organizer_name || null,
        organizerContact: validatedData.organizer_contact || null,
        sourceText: validatedData.source_text || null,
        createdById: user.id,
        status: "DRAFT",
        moderationStatus: "PENDING",
        searchText,
        searchTextFolded,
        categories: [],
        languages: ["en"],
        imageUrls: validatedData.imageUrl ? [validatedData.imageUrl] : [],
      },
    })

    console.log("[v0] CANONICAL submit: Event created:", event.id)

    await db.eventAuditLog.create({
      data: {
        eventId: event.id,
        actor: "user",
        actorId: user.id,
        action: "created",
        newStatus: "PENDING",
        notes: validatedData.source_text
          ? "Event created via AI-powered natural language interface"
          : "Event submitted for moderation",
      },
    })

    let emailSent = false
    try {
      console.log(`[v0] CANONICAL submit: Sending edit link email to ${creatorEmail}`)
      const token = await createEventEditToken(event.id, event.endAt)
      await sendEventEditLinkEmail(creatorEmail, event.title, event.id, token)
      emailSent = true
      console.log(`[v0] CANONICAL submit: ✓ Edit link email sent successfully`)
    } catch (emailError) {
      console.error("[v0] CANONICAL submit: ✗ Failed to send edit link email:", emailError)
      console.error(
        "[v0] CANONICAL submit: Email error details:",
        emailError instanceof Error ? emailError.message : String(emailError),
      )
    }

    moderateEventContent({
      title: validatedData.title,
      description: validatedData.description,
      city: validatedData.location?.address?.split(",")[0]?.trim() || "Unknown",
      country: "Australia",
      externalUrl: validatedData.externalUrl || undefined,
    })
      .then(async (moderationResult) => {
        console.log("[v0] CANONICAL submit: Moderation result:", moderationResult)

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
            oldStatus: "PENDING",
            newStatus,
            reason: moderationResult.reason,
            notes: `AI moderation: ${moderationResult.policy_category} (${moderationResult.severity_level} severity)`,
          },
        })

        if (moderationResult.status === "flagged" || moderationResult.status === "rejected") {
          await notifyAdminOfFlaggedEvent({
            id: event.id,
            title: validatedData.title,
            description: validatedData.description,
            moderationStatus: moderationResult.status.toUpperCase(),
            moderationReason: moderationResult.reason,
            moderationSeverity: moderationResult.severity_level.toUpperCase(),
            moderationCategory: moderationResult.policy_category,
          })

          if (moderationResult.status === "rejected") {
            try {
              await sendEmail({
                to: creatorEmail,
                subject: `Event Rejected: ${validatedData.title}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">Event Rejected</h2>
                    <p>Hello,</p>
                    <p>Unfortunately, your event submission has been rejected by our automated moderation system.</p>
                    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">
                      <p style="margin: 0; font-weight: bold;">Event: ${validatedData.title}</p>
                      <p style="margin: 8px 0 0 0;">Reason: ${moderationResult.reason}</p>
                      <p style="margin: 8px 0 0 0;">Category: ${moderationResult.policy_category}</p>
                    </div>
                    <p>If you believe this decision was made in error, you can edit your event and resubmit it.</p>
                  </div>
                `,
              })
            } catch (emailError) {
              console.error("[v0] CANONICAL submit: Failed to send rejection email:", emailError)
            }
          }
        }
      })
      .catch((error) => {
        console.error("[v0] CANONICAL submit: ✗ Moderation failed:", error)
      })

    return NextResponse.json({
      ok: true,
      eventId: event.id,
      emailSent,
    })
  } catch (error) {
    console.error("[v0] CANONICAL submit: Error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to submit event. Please try again.",
      },
      { status: 500 },
    )
  }
}
