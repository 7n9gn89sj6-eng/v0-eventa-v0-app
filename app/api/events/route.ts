import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth-helpers"
import { geocodeAddress } from "@/lib/geocoding"
import { createSearchTextFolded } from "@/lib/search/accent-fold"
import { createEventEditToken } from "@/lib/eventEditToken"
import { ok, fail, validationError } from "@/lib/http"

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
    const status = searchParams.get("status") // Added status filter
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    const where: any = {}

    if (status) {
      where.status = status
    } else {
      where.status = "PUBLISHED"
    }

    where.moderationStatus = "APPROVED"

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
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
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
    const user = await requireAuth()
    const body = await request.json()

    const data = EventCreate.parse(body)

    const { title, description, categories, startAt, endAt } = data

    let lat: number | undefined = data.lat
    let lng: number | undefined = data.lng
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

    const searchParts = [title, description, venueName, address, ...(categories || []), ...(body.languages || [])]
    const searchText = searchParts.filter(Boolean).join(" ")
    const searchTextFolded = createSearchTextFolded(searchParts)

    const event = await prisma.event.create({
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

    let emailedEditLink = false
    try {
      const token = await createEventEditToken(event.id, event.endAt)
      console.log("[v0] Email disabled - Edit link token created but not emailed for event:", event.id)
      emailedEditLink = false // Email functionality disabled
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
