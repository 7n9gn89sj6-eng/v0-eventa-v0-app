import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"
import type { EventCategory } from "@prisma/client"

const EXTERNAL_STUB_EVENTS = [
  {
    id: "ext-1",
    title: "Summer Music Festival",
    description: "Annual outdoor music festival featuring local and international artists",
    startAt: new Date("2025-07-15T18:00:00Z"),
    endAt: new Date("2025-07-15T23:00:00Z"),
    location: {
      address: "Central Park",
      city: "New York",
      country: "USA",
    },
    imageUrl: "/vibrant-music-festival.png",
    externalUrl: "https://example.com/summer-fest",
    source: "web",
  },
  {
    id: "ext-2",
    title: "Tech Conference 2025",
    description: "Leading technology conference with workshops and networking",
    startAt: new Date("2025-08-20T09:00:00Z"),
    endAt: new Date("2025-08-22T17:00:00Z"),
    location: {
      address: "Convention Center",
      city: "San Francisco",
      country: "USA",
    },
    imageUrl: "/tech-conference.png",
    externalUrl: "https://example.com/tech-conf",
    source: "web",
  },
]

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("query") || url.searchParams.get("q") || "").trim()
  const take = Math.min(Number.parseInt(url.searchParams.get("take") || "20", 10) || 20, 50)
  const page = Math.max(Number.parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
  const skip = (page - 1) * take
  const city = url.searchParams.get("city")
  const country = url.searchParams.get("country")
  const category = url.searchParams.get("category")
  const dateFrom = url.searchParams.get("date_from")
  const dateTo = url.searchParams.get("date_to")

  console.log("[v0] Search params:", { q, city, category, dateFrom, dateTo })

  try {
    if (!q) {
      const where: any = {
        ...PUBLIC_EVENT_WHERE,
      }

      if (category && category !== "all") {
        const categoryEnum = category.toUpperCase() as EventCategory
        where.category = categoryEnum
      }

      if (dateFrom) {
        where.startAt = { ...where.startAt, gte: new Date(dateFrom) }
      }
      if (dateTo) {
        where.startAt = { ...where.startAt, lte: new Date(dateTo) }
      }

      if (city) {
        where.city = { contains: city, mode: "insensitive" }
      }
      if (country) {
        where.country = { contains: country, mode: "insensitive" }
      }

      const [events, count] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
          take,
          skip,
        }),
        prisma.event.count({ where }),
      ])
      return NextResponse.json({
        events,
        count,
        page,
        take,
        internal: events,
        external: [],
        total: count,
      })
    }

    const where: any = {
      ...PUBLIC_EVENT_WHERE,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
        { venueName: { contains: q, mode: "insensitive" } },
      ],
    }

    if (category && category !== "all") {
      const categoryEnum = category.toUpperCase() as EventCategory
      where.category = categoryEnum
    }

    if (dateFrom) {
      where.startAt = { ...where.startAt, gte: new Date(dateFrom) }
    }
    if (dateTo) {
      where.startAt = { ...where.startAt, lte: new Date(dateTo) }
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" }
    }
    if (country) {
      where.country = { contains: country, mode: "insensitive" }
    }

    const [events, count] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
      prisma.event.count({ where }),
    ])

    console.log("[v0] Search query:", q, "filters:", { city, category, dateFrom, dateTo }, "found:", count, "events")

    const externalEvents = EXTERNAL_STUB_EVENTS.filter((event) => {
      const matchesQuery =
        event.title.toLowerCase().includes(q.toLowerCase()) ||
        event.description.toLowerCase().includes(q.toLowerCase()) ||
        event.location.city.toLowerCase().includes(q.toLowerCase())

      const matchesCity = !city || event.location.city.toLowerCase().includes(city.toLowerCase())
      const matchesCountry = !country || event.location.country.toLowerCase().includes(country.toLowerCase())

      return matchesQuery && matchesCity && matchesCountry
    })

    return NextResponse.json({
      events,
      count,
      page,
      take,
      query: q,
      internal: events,
      external: externalEvents,
      total: count + externalEvents.length,
    })
  } catch (e: any) {
    console.error("[v0] search/events error:", e)
    return NextResponse.json(
      {
        events: [],
        count: 0,
        internal: [],
        external: [],
        total: 0,
        error: String(e?.message || e),
      },
      { status: 500 },
    )
  }
}
