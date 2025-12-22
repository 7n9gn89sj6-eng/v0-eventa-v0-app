import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-helpers"
import { geocodeAddress } from "@/lib/geocoding"
import { createSearchTextFolded } from "@/lib/search/accent-fold"
import { createEventEditToken } from "@/lib/eventEditToken"
import { ok, fail, validationError } from "@/lib/http"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"
import { detectEventLanguage } from "@/lib/search/language-detection-enhanced"
import { generateEventEmbedding, shouldSkipEmbedding } from "@/lib/embeddings/generate"
import { storeEventEmbedding } from "@/lib/embeddings/store"

const EventCreate = z
  .object({
    title: z.string().min(3).max(120),
    description: z.string().max(5000).optional(),
    startAt: z.coerce.date({ required_error: "Start date is required" }),
    endAt: z.coerce.date({ required_error: "End date is required" }),
    url: z.string().url().optional(),
    categories: z.array(z.string()).max(10).optional(),
    images: z.array(z.string().url()).max(10).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    contactEmail: z.string().email().optional(),
  })
  .refine((d) => d.endAt > d.startAt, {
    path: ["endAt"],
    message: "End date must be after start date",
  })

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const free = searchParams.get("free")
    const status = searchParams.get("status")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    const where: any = {}

    if (status) {
      where.status = status
    } else {
      Object.assign(where, PUBLIC_EVENT_WHERE)
    }

    where.moderationStatus = "APPROVED"

    if (category) {
      where.categories = { has: category }
    }

    if (free === "true") {
      where.priceFree = true
    }

    const events = await db.event.findMany({
      where,
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { startAt: "asc" },
      take: limit,
    })

    return ok({ events })
  } catch (error) {
    console.error("Error fetching events:", error)
    return fail("Failed to fetch events", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const data = EventCreate.parse(body)

    const { title, description, categories, startAt, endAt } = data

    let lat = data.lat
    let lng = data.lng
    let geocodedAddress: string | undefined
    let venueName: string | undefined
    let address: string | undefined

    if (body.address) {
      address = body.address
      const geocoded = await geocodeAddress(address)
      if (geocoded) {
        lat = geocoded.lat
        lng = geocoded.lng
        geocodedAddress = geocoded.address
      }
    }

    const searchParts = [
      title,
      description,
      venueName,
      address,
      ...(categories || []),
      ...(body.languages || []),
    ]

    const searchText = searchParts.filter(Boolean).join(" ")
    const searchTextFolded = createSearchTextFolded(searchParts)

    // Detect language from title + description (async, non-blocking)
    console.log("[events] Starting language detection for new event:", { titlePreview: title.substring(0, 50) })
    const detectedLanguage = await detectEventLanguage(title, description || null).catch((error) => {
      console.warn("[events] Language detection failed:", error)
      return null
    })
    console.log("[events] Language detection result:", { detectedLanguage, titlePreview: title.substring(0, 50) })

    const event = await db.event.create({
      data: {
        title,
        description: description || "",
        categories: categories || [],
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        timezone: body.timezone || "UTC",
        venueName: body.venueName,
        address: geocodedAddress || address,
        lat,
        lng,
        priceFree: body.priceFree ?? false,
        priceAmount: body.priceAmount ? Number.parseInt(body.priceAmount) : null,
        websiteUrl: data.url || body.websiteUrl,
        languages: body.languages || ["en"],
        ...(detectedLanguage ? { language: detectedLanguage } : {}), // Store detected language (only if detected)
        imageUrls: data.images || body.imageUrls || [],
        searchText,
        searchTextFolded,
        createdById: user.id!,
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Generate and store embedding (async, non-blocking, errors don't fail event creation)
    if (!shouldSkipEmbedding()) {
      console.log("[events] Starting embedding generation for event:", { eventId: event.id, titlePreview: title.substring(0, 50) })
      generateEventEmbedding(title, description || null, body.venueName, categories || [])
        .then(async (embedding) => {
          if (embedding) {
            console.log("[events] Embedding generated, storing for event:", { eventId: event.id })
            await storeEventEmbedding(event.id, embedding).catch((error) => {
              console.warn(`[events] Failed to store embedding for event ${event.id}:`, error)
            })
          } else {
            console.warn("[events] Embedding generation returned null for event:", { eventId: event.id })
          }
        })
        .catch((error) => {
          console.warn(`[events] Embedding generation failed for event ${event.id}:`, error)
          // Embedding is optional, don't fail event creation
        })
    } else {
      console.log("[events] Embedding generation skipped (SKIP_EMBEDDING_GENERATION=true)")
    }

    let emailedEditLink = false
    try {
      const token = await createEventEditToken(event.id, event.endAt)
      console.log("[v0] Edit link token created but email sending disabled")
      emailedEditLink = false
    } catch (error) {
      console.error("[v0] Failed to create edit link token:", error)
    }

    return NextResponse.json({ event, emailedEditLink }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating event:", error)

    if (error.message === "Unauthorized") {
      return fail("Unauthorized", 401)
    }

    if (error instanceof z.ZodError) {
      return validationError("Invalid request data", error.errors)
    }

    return fail("Failed to create event", 500)
  }
}
