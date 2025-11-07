import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { moderateEventContent } from "@/lib/ai-moderation"
import { sendVerificationEmail } from "@/lib/email"
import { createAuditLog } from "@/lib/audit-log"
import { checkRateLimit } from "@/lib/rate-limit"
import type { EventExtractionOutput } from "@/lib/types"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: "You've reached today's posting limit. Try again soon." }, { status: 429 })
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

    if (!sourceText || !extraction) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Parse location from extraction
    const city = extraction.location.name || extraction.location.address || "Unknown"
    const country = "Australia" // Default, could be extracted from location

    // Create event in database
    const event = await prisma.event.create({
      data: {
        title: extraction.title,
        description: extraction.description,
        startAt: new Date(extraction.start),
        endAt: extraction.end ? new Date(extraction.end) : new Date(extraction.start),
        venueName: extraction.location.name || undefined,
        address: extraction.location.address || undefined,
        city,
        country,
        lat: extraction.location.lat || undefined,
        lng: extraction.location.lng || undefined,
        timezone: extraction.timezone || "UTC",
        priceFree: extraction.price === "free",
        priceAmount: extraction.price === "paid" ? 0 : undefined,
        imageUrl: imageUrl || undefined,
        externalUrl: externalUrl || undefined,
        // Phase 3 fields
        sourceText,
        category: category !== "auto" ? category : extraction.category !== "auto" ? extraction.category : undefined,
        tags: extraction.tags,
        extractionConfidence: extraction.confidence as any,
        organizerName: extraction.organizer_name || undefined,
        organizerContact: contactInfo || extraction.organizer_contact || undefined,
        // Set status
        status: "PUBLISHED",
        moderationStatus: "PENDING",
        createdById: session.user.id,
        searchText: `${extraction.title} ${extraction.description} ${city} ${country}`,
        categories: [],
        languages: [],
        imageUrls: [],
      },
    })

    // Create edit token
    const token = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    await prisma.eventEditToken.create({
      data: {
        eventId: event.id,
        tokenHash,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })

    // Send verification email
    await sendVerificationEmail(session.user.email, event.id, token)

    // Create audit log
    await createAuditLog({
      eventId: event.id,
      actor: "user",
      actorId: session.user.id,
      action: "created",
      newStatus: "PENDING",
      notes: "Event created via plain language interface",
    })

    // Run AI moderation in background (don't await)
    moderateEventContent({
      title: event.title,
      description: event.description,
      city: event.city,
      country: event.country,
      externalUrl: event.externalUrl || undefined,
    })
      .then(async (moderationResult) => {
        await prisma.event.update({
          where: { id: event.id },
          data: {
            moderationStatus: moderationResult.status.toUpperCase() as any,
            moderationReason: moderationResult.reason,
            moderationSeverity: moderationResult.severity_level.toUpperCase() as any,
            moderationCategory: moderationResult.policy_category,
            moderatedAt: new Date(),
          },
        })

        await createAuditLog({
          eventId: event.id,
          actor: "ai",
          action:
            moderationResult.status === "approved"
              ? "approved"
              : moderationResult.status === "rejected"
                ? "rejected"
                : "flagged",
          newStatus: moderationResult.status.toUpperCase(),
          reason: moderationResult.reason,
          notes: `AI moderation confidence: ${Math.round(moderationResult.confidence * 100)}%`,
        })
      })
      .catch((error) => {
        console.error("[v0] Background moderation error:", error)
      })

    return NextResponse.json({
      success: true,
      eventId: event.id,
    })
  } catch (error) {
    console.error("[v0] Create simple event error:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}
