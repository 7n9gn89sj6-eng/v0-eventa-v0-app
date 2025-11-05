import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth-helpers"
import { geocodeAddress } from "@/lib/geocoding"
import { createSearchTextFolded } from "@/lib/search/accent-fold"
import { createEventEditToken } from "@/lib/eventEditToken"
import { sendEventEditLinkEmail } from "@/lib/email"
import { ok, fail, validationError } from "@/lib/http"
import { ratelimit, strictRatelimit } from "@/lib/rate-limit"
import { sanitizeString, isValidCategory, isValidUrl } from "@/lib/sanitize"

const EventCreate = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(5000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  url: z.string().url().optional(),
  categories: z.array(z.string()).max(10).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  contactEmail: z.string().email().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const ip = request.ip ?? "127.0.0.1"
    const { success } = await ratelimit.limit(ip)

    if (!success) {
      return fail("Too many requests", 429)
    }

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const free = searchParams.get("free")
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50"), 100)

    if (category && !isValidCategory(category)) {
      return fail("Invalid category parameter", 400)
    }

    const where: any = {
      status: "PUBLISHED",
    }

    if (category) {
      where.categories = {
        has: category,
      }
    }

    if (free === "true") {
      where.priceFree = true
    }

    const events = await prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        timezone: true,
        venueName: true,
        address: true,
        lat: true,
        lng: true,
        priceFree: true,
        priceAmount: true,
        websiteUrl: true,
        categories: true,
        imageUrls: true,
        createdAt: true,
        // Don't expose creator email or sensitive data
      },
      orderBy: {
        startAt: "asc",
      },
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
    const ip = request.ip ?? "127.0.0.1"
    const { success } = await strictRatelimit.limit(ip)

    if (!success) {
      return fail("Too many requests. Please wait before creating another event.", 429)
    }

    const user = await requireAuth()
    const body = await request.json()

    const bodyString = JSON.stringify(body)
    if (bodyString.length > 50000) {
      return fail("Request body too large", 413)
    }

    const data = EventCreate.parse(body)

    if (new Date(data.endAt) < new Date(data.startAt)) {
      return fail("endAt must be after startAt", 400)
    }

    const title = sanitizeString(data.title, 120)
    const description = data.description ? sanitizeString(data.description, 5000) : ""

    const categories = data.categories?.filter(isValidCategory) || []

    const imageUrls = data.images?.filter(isValidUrl) || []

    const websiteUrl = data.url && isValidUrl(data.url) ? data.url : undefined

    const { startAt, endAt } = data

    let lat: number | undefined = data.lat
    let lng: number | undefined = data.lng
    let geocodedAddress: string | undefined
    let venueName: string | undefined
    let address: string | undefined

    if (body.address) {
      if (body.address.length > 500) {
        return fail("Address too long", 400)
      }
      address = sanitizeString(body.address, 500)
      const geocoded = await geocodeAddress(address)
      if (geocoded) {
        lat = geocoded.lat
        lng = geocoded.lng
        geocodedAddress = geocoded.address
      }
    }

    if (body.venueName) {
      venueName = sanitizeString(body.venueName, 200)
    }

    const searchParts = [title, description, venueName, address, ...categories, ...(body.languages || [])]
    const searchText = searchParts.filter(Boolean).join(" ")
    const searchTextFolded = createSearchTextFolded(searchParts)

    const event = await prisma.event.create({
      data: {
        title,
        description,
        categories,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        timezone: body.timezone || "UTC",
        venueName,
        address: geocodedAddress || address,
        lat,
        lng,
        priceFree: body.priceFree ?? false,
        priceAmount: body.priceAmount ? Number.parseInt(body.priceAmount) : null,
        websiteUrl: websiteUrl || body.websiteUrl,
        languages: body.languages || ["en"],
        imageUrls,
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

    let emailedEditLink = false
    try {
      const token = await createEventEditToken(event.id, event.endAt)

      const recipientEmail = data.contactEmail || user.email || process.env.EVENT_CREATOR_FALLBACK_EMAIL

      if (recipientEmail) {
        await sendEventEditLinkEmail(recipientEmail, event.title, event.id, token)
        emailedEditLink = true
      }
    } catch (emailError) {
      console.error("Failed to send edit link email:", emailError)
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
