import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EventSubmitSchema = z
  .object({
    title: z.string().min(2),
    description: z.string().default(""),
    start: z.coerce.date({ required_error: "Start date and time is required" }),
    end: z.coerce.date().optional(),
    timezone: z.string().optional(),
    location: z
      .object({
        name: z.string().optional(),
        address: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .optional(),
    organizer_name: z.string().optional(),
    organizer_contact: z.string().optional(),
    creatorEmail: z.string().email().optional(),
    imageUrl: z.string().url().optional().or(z.literal("")),
    externalUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine((d) => !d.end || d.end > d.start, {
    path: ["end"],
    message: "End date must be after start date",
  })

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] POST /api/events/submit - starting")

    const body = await request.json()
    console.log("[v0] Request body received:", {
      title: body?.title,
      hasEmail: !!body?.creatorEmail,
    })

    const validatedData = EventSubmitSchema.parse(body)

    const creatorEmail = validatedData.creatorEmail
    if (!creatorEmail) {
      console.log("[v0] Missing creator email")
      return NextResponse.json({ error: "Creator email is required" }, { status: 400 })
    }

    const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL
    if (!NEON_DATABASE_URL) {
      console.error("[v0] NEON_DATABASE_URL is missing")
      return NextResponse.json({ error: "Server configuration error. Please contact support." }, { status: 500 })
    }

    console.log("[v0] Connecting to database…")
    const sql = neon(NEON_DATABASE_URL)

    let userId: string
    const existingUsers = await sql`
      SELECT id FROM "User" WHERE email = ${creatorEmail} LIMIT 1
    `
    if (existingUsers.length > 0) {
      userId = existingUsers[0].id
      console.log("[v0] Found existing user:", userId)
    } else {
      const userName = validatedData.organizer_name || creatorEmail.split("@")[0]
      const newUserId = generateId()
      await sql`
        INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
        VALUES (${newUserId}, ${creatorEmail}, ${userName}, NOW(), NOW())
      `
      userId = newUserId
      console.log("[v0] Created new user:", userId)
    }

    const addressRaw = validatedData.location?.address ?? ""
    const addressParts = addressRaw
      ? addressRaw
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : []
    const city = addressParts[1] || addressParts[0] || "Unknown"
    const country = addressParts[addressParts.length - 1] || "Australia"

    const eventId = generateId()
    console.log("[v0] Creating event:", { eventId, title: validatedData.title })

    const searchText = `${validatedData.title} ${validatedData.description} ${city} ${country}`.toLowerCase()

    await sql`
      INSERT INTO "Event" (
        id,
        title,
        description,
        "startAt",
        "endAt",
        timezone,
        "venueName",
        address,
        city,
        country,
        "imageUrl",
        "externalUrl",
        "searchText",
        "createdById",
        status,
        "aiStatus",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${eventId},
        ${validatedData.title},
        ${validatedData.description},
        ${validatedData.start.toISOString()},
        ${validatedData.end ? validatedData.end.toISOString() : validatedData.start.toISOString()},
        ${validatedData.timezone || "UTC"},
        ${validatedData.location?.name || null},
        ${addressRaw || null},
        ${city},
        ${country},
        ${validatedData.imageUrl || null},
        ${validatedData.externalUrl || null},
        ${searchText},
        ${userId},
        'DRAFT',
        'PENDING',
        NOW(),
        NOW()
      )
    `

    console.log("[v0] Event created successfully")

    console.log("[v0] Starting AI moderation...")
    try {
      const { moderateEventContent } = await import("@/lib/ai-moderation")
      const moderationResult = await moderateEventContent({
        title: validatedData.title,
        description: validatedData.description,
        city,
        country,
        externalUrl: validatedData.externalUrl || undefined,
      })

      console.log("[v0] AI moderation completed:", moderationResult)

      let aiStatus: "SAFE" | "NEEDS_REVIEW" | "REJECTED"
      let eventStatus: "DRAFT" | "PUBLISHED"

      if (moderationResult.status === "approved") {
        aiStatus = "SAFE"
        eventStatus = "PUBLISHED"
      } else if (moderationResult.status === "flagged") {
        aiStatus = "NEEDS_REVIEW"
        eventStatus = "DRAFT"
      } else {
        aiStatus = "REJECTED"
        eventStatus = "DRAFT"
      }

      await sql`
        UPDATE "Event"
        SET 
          "aiStatus" = ${aiStatus},
          "aiReason" = ${moderationResult.reason},
          "aiAnalyzedAt" = NOW(),
          status = ${eventStatus},
          "publishedAt" = ${aiStatus === "SAFE" ? new Date().toISOString() : null},
          "updatedAt" = NOW()
        WHERE id = ${eventId}
      `

      console.log("[v0] Event updated with AI moderation results:", {
        aiStatus,
        eventStatus,
        reason: moderationResult.reason,
      })
    } catch (aiError) {
      console.error("[v0] AI moderation failed, event will remain pending:", aiError)
    }

    const token = generateId()
    const tokenHash = await bcrypt.hash(token, 10)
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await sql`
      INSERT INTO "EventEditToken" (id, "eventId", "tokenHash", expires, "createdAt")
      VALUES (${generateId()}, ${eventId}, ${tokenHash}, ${expires.toISOString()}, NOW())
    `

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const editUrl = `${appUrl}/event/confirm?token=${token}`

    try {
      const { sendEventEditLinkEmail } = await import("@/lib/email")
      await sendEventEditLinkEmail(creatorEmail, validatedData.title, eventId, token)
      console.log("[v0] Submission email sent successfully to:", creatorEmail)
      console.log("[v0] Edit token generated:", `${token.slice(0, 10)}...`)
    } catch (emailError) {
      console.error("[v0] Failed to send submission email, but event was created:", emailError)
    }

    return NextResponse.json({
      ok: true,
      eventId,
      token,
      editUrl,
      message: "Event created successfully! Your submission is awaiting approval.",
    })
  } catch (error) {
    console.error("[v0] Error in POST /api/events/submit:", error)
    console.error("[v0] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    if (error instanceof z.ZodError) {
      console.error("[v0] Validation errors:", error.issues)
      return NextResponse.json({ error: "Validation failed", errors: error.issues }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit event" },
      { status: 500 },
    )
  }
}
