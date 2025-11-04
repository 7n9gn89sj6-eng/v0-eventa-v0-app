import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth-helpers"
import { geocodeAddress } from "@/lib/geocoding"
import { createSearchTextFolded } from "@/lib/search/accent-fold"
import { createEventEditToken } from "@/lib/eventEditToken"
import { sendEventEditLinkEmail } from "@/lib/email"

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
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const free = searchParams.get("free")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    const where: any = {}

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

    return NextResponse.json({ events })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const data = EventCreate.parse(body)

    if (new Date(data.endAt) < new Date(data.startAt)) {
      return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 })
    }

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
        startAt: new Date(startAt),
        endAt: new Date(endAt),
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

      const recipientEmail = data.contactEmail || user.email || process.env.EVENT_CREATOR_FALLBACK_EMAIL

      if (recipientEmail) {
        await sendEventEditLinkEmail(recipientEmail, event.title, event.id, token)
        emailedEditLink = true
        console.log(`[v0] Edit link email sent to ${recipientEmail} for event ${event.id}`)
      } else {
        console.warn(`[v0] No recipient email available for event ${event.id}`)
      }
    } catch (emailError) {
      console.error("[v0] Failed to send edit link email:", emailError)
    }

    return NextResponse.json({ event, emailedEditLink }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating event:", error)

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}
