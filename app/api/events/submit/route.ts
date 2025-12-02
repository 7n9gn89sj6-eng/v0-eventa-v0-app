import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/* ------------------------- VALIDATION ------------------------- */

const EventSubmitSchema = z
  .object({
    title: z.string().min(2),
    description: z.string().default(""),
    start: z.coerce.date({
      required_error: "Start date/time is required",
    }),
    end: z.coerce.date().optional(),
    timezone: z.string().optional(),

    location: z
      .object({
        name: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),

    creatorEmail: z.string().email({
      message: "Creator email is required",
    }),

    // matches your form: single optional URL
    imageUrl: z.string().url().optional().or(z.literal("")),

    externalUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine((d) => !d.end || d.end > d.start, {
    path: ["end"],
    message: "End must be after start",
  })

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/* ------------------------- ROUTE ------------------------- */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("[v0] Incoming body:", body)

    const validated = EventSubmitSchema.parse(body)

    // categories & languages ALWAYS arrays (db columns are NOT NULL text[])
    const categories: string[] = Array.isArray(body.categories)
      ? body.categories
      : []

    const languages: string[] = Array.isArray(body.languages)
      ? body.languages
      : []

    // legacy imageUrls column (text[] NOT NULL) – always send an array
    const imageUrls: string[] =
      validated.imageUrl && validated.imageUrl.trim() !== ""
        ? [validated.imageUrl]
        : []

    const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL
    if (!NEON_DATABASE_URL) {
      console.error("[v0] NEON_DATABASE_URL is missing")
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 },
      )
    }

    const sql = neon(NEON_DATABASE_URL)

    /* --- ensure user exists --- */

    let userId: string

    const existing = await sql`
      SELECT id FROM "User"
      WHERE email = ${validated.creatorEmail}
      LIMIT 1
    `

    if (existing.length > 0) {
      userId = existing[0].id
    } else {
      userId = generateId()
      await sql`
        INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
        VALUES (
          ${userId},
          ${validated.creatorEmail},
          ${validated.creatorEmail.split("@")[0]},
          NOW(),
          NOW()
        )
      `
    }

    /* --- derive city / country from address --- */

    const address = validated.location?.address ?? ""
    const parts = address
      ? address.split(",").map((p) => p.trim()).filter(Boolean)
      : []
    const city = parts[1] || parts[0] || "Unknown"
    const country = parts[parts.length - 1] || "Australia"

    const eventId = generateId()

    const searchText = `${validated.title} ${validated.description} ${city} ${country}`.toLowerCase()

    /* ------------------------- INSERT ------------------------- */

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
        "imageUrls",
        "externalUrl",
        categories,
        languages,
        "searchText",
        "createdById",
        status,
        "aiStatus",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${eventId},
        ${validated.title},
        ${validated.description},
        ${validated.start.toISOString()},
        ${
          validated.end
            ? validated.end.toISOString()
            : validated.start.toISOString()
        },
        ${validated.timezone || "UTC"},
        ${validated.location?.name || null},
        ${address || null},
        ${city},
        ${country},
        ${validated.imageUrl || null},
        ${imageUrls},
        ${validated.externalUrl || null},
        ${categories},
        ${languages},
        ${searchText},
        ${userId},
        'DRAFT',
        'PENDING',
        NOW(),
        NOW()
      )
    `

    console.log("[v0] Event created:", eventId)

    // (You can re-add the AI moderation + email token bits later;
    // for now we just return success.)

    return NextResponse.json({
      ok: true,
      eventId,
      message: "Event submitted successfully",
    })
  } catch (error) {
    console.error("SUBMIT ERROR:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

