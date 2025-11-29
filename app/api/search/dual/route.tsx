// app/api/search/dual/route.tsx

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import type { EventCategory } from "@prisma/client"

// External AI stub events (replace later with real scraper)
const EXTERNAL_STUB_EVENTS = [
  {
    id: "ext-1",
    title: "Summer Music Festival",
    description: "Annual outdoor music festival with artists worldwide",
    startAt: "2025-07-15T18:00:00Z",
    endAt: "2025-07-15T23:00:00Z",
    city: "New York",
    country: "USA",
    address: "Central Park",
    imageUrl: "/vibrant-music-festival.png",
    externalUrl: "https://example.com/summer",
    source: "web",
  },
  {
    id: "ext-2",
    title: "Tech Conference 2025",
    description: "Global technology event with workshops",
    startAt: "2025-08-20T09:00:00Z",
    endAt: "2025-08-22T17:00:00Z",
    city: "San Francisco",
    country: "USA",
    address: "Convention Center",
    imageUrl: "/tech-conference.png",
    externalUrl: "https://example.com/tech",
    source: "web",
  },
]

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)

    // Basic params
    const q = url.searchParams.get("q") || url.searchParams.get("query") || ""
    const city = url.searchParams.get("city") || undefined
    const category = url.searchParams.get("category") || undefined
    const dateFrom = url.searchParams.get("date_from") || undefined
    const dateTo = url.searchParams.get("date_to") || undefined

    let where: any = {
      status: "PUBLISHED",
      aiStatus: "SAFE",
    }

    // Category
    if (category && category !== "all") {
      where.category = (category || "").toUpperCase() as EventCategory
    }

    // Date range
    if (dateFrom) {
      where.startAt = { ...where.startAt, gte: new Date(dateFrom) }
    }
    if (dateTo) {
      where.startAt = { ...where.startAt, lte: new Date(dateTo) }
    }

    // City
    if (city) {
      where.city = { contains: city, mode: "insensitive" }
    }

    // Query
    if (q.trim() !== "") {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ]
    }

    // Fetch community events
    const internalEvents = await prisma.event.findMany({
      where,
      orderBy: [{ startAt: "asc" }],
    })

    // External events filtering
    const externalEvents = EXTERNAL_STUB_EVENTS.filter((ev) => {
      const matchQuery =
        q.trim() === "" ||
        ev.title.toLowerCase().includes(q.toLowerCase()) ||
        ev.description.toLowerCase().includes(q.toLowerCase())

      const matchCity = !city || ev.city.toLowerCase().includes(city.toLowerCase())

      return matchQuery && matchCity
    })

    // Merge — community first
    const merged = [...internalEvents, ...externalEvents]

    return NextResponse.json({
      q,
      city,
      internal: internalEvents,
      external: externalEvents,
      total: merged.length,
      events: merged,
    })
  } catch (err) {
    console.error("[Search Dual API ERROR]", err)

    return NextResponse.json(
      {
        internal: [],
        external: [],
        events: [],
        error: "Search failed",
      },
      { status: 500 },
    )
  }
}
