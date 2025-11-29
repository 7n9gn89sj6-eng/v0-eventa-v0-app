// app/api/search/events/route.tsx

import { NextRequest, NextResponse } from "next/server"
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
    location: { address: "Central Park", city: "New York", country: "USA" },
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
    location: { address: "Convention Center", city: "San Francisco", country: "USA" },
    imageUrl: "/tech-conference.png",
    externalUrl: "https://example.com/tech-conf",
    source: "web",
  },
]

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)

    const q = (url.searchParams.get("query") || url.searchParams.get("q") || "").trim()
    const city = url.searchParams.get("city") || undefined
    const country = url.searchParams.get("country") || undefined
    const category = url.searchParams.get("category") || undefined
    const dateFrom = url.searchParams.get("date_from") || undefined
    const dateTo = url.searchParams.get("date_to") || undefined

    console.log("[api/search/events] params:", { q, city, country, category, dateFrom, dateTo })

    //
    // BUILD WHERE CLAUSE
    //
    const where: any = { ...PUBLIC_EVENT_WHERE }

    if (category && category !== "all") {
      where.category = category.toUpperCase() as EventCategory
    }

    if (dateFrom) where.startAt = { ...where.startAt, gte: new Date(dateFrom) }
    if (dateTo) where.startAt = { ...where.startAt, lte: new Date(dateTo) }

    if (city) where.city = { contains: city, mode: "insensitive" }
    if (country) where.country = { contains: country, mode: "insensitive" }

    // text search
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
        { venueName: { contains: q, mode: "insensitive" } },
      ]
    }

    //
    // INTERNAL EVENTS
    //
    const internal = await prisma.event.findMany({
      where,
      orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    })

    //
    // EXTERNAL STUB
    //
    const external = q
      ? EXTERNAL_STUB_EVENTS.filter((ev) => {
          const mq =
            ev.title.toLowerCase().includes(q.toLowerCase()) ||
            ev.description.toLowerCase().includes(q.toLowerCase())
          const mc = !city || ev.location.city.toLowerCase().includes(city.toLowerCase())
          return mq && mc
        })
      : []

    return NextResponse.json({
      events: [...internal, ...external],
      internal,
      external,
      total: internal.length + external.length,
    })
  } catch (err: any) {
    console.error("ERROR in /api/search/events:", err)
    return NextResponse.json(
      { error: err?.message || "Search failed." },
      { status: 500 }
    )
  }
}
