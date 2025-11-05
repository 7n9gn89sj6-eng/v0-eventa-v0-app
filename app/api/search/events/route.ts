import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

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

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")
    const city = searchParams.get("city")
    const country = searchParams.get("country")

    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
    }

    if (query.length > 200) {
      return NextResponse.json({ error: "Query too long (max 200 characters)" }, { status: 400 })
    }

    if (city && city.length > 100) {
      return NextResponse.json({ error: "City parameter too long" }, { status: 400 })
    }

    if (country && country.length > 100) {
      return NextResponse.json({ error: "Country parameter too long" }, { status: 400 })
    }

    let internalEvents = []
    let dbError = false

    try {
      internalEvents = await db.event.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
            { country: { contains: query, mode: "insensitive" } },
          ],
          ...(city && { city: { contains: city, mode: "insensitive" } }),
          ...(country && { country: { contains: country, mode: "insensitive" } }),
        },
        select: {
          id: true,
          title: true,
          description: true,
          startAt: true,
          endAt: true,
          locationAddress: true,
          city: true,
          country: true,
          imageUrl: true,
          externalUrl: true,
        },
        orderBy: {
          startAt: "asc",
        },
        take: 20,
      })
    } catch (error) {
      console.error("[v0] Database search error:", error)
      dbError = true
    }

    const tier1Latency = Date.now() - startTime

    const tier2StartTime = Date.now()
    const externalEvents = EXTERNAL_STUB_EVENTS.filter((event) => {
      const matchesQuery =
        event.title.toLowerCase().includes(query.toLowerCase()) ||
        event.description.toLowerCase().includes(query.toLowerCase()) ||
        event.location.city.toLowerCase().includes(query.toLowerCase())

      const matchesCity = !city || event.location.city.toLowerCase().includes(city.toLowerCase())
      const matchesCountry = !country || event.location.country.toLowerCase().includes(country.toLowerCase())

      return matchesQuery && matchesCity && matchesCountry
    })

    const tier2Latency = Date.now() - tier2StartTime

    const results = {
      internal: internalEvents.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        location: {
          address: event.locationAddress,
          city: event.city,
          country: event.country,
        },
        imageUrl: event.imageUrl,
        externalUrl: event.externalUrl,
        source: "eventa",
      })),
      external: externalEvents,
      total: internalEvents.length + externalEvents.length,
      latency: {
        tier1_ms: tier1Latency,
        tier2_ms: tier2Latency,
        total_ms: Date.now() - startTime,
      },
      ...(dbError && { warning: "Internal search temporarily unavailable" }),
    }

    console.log("[v0] Search completed:", {
      query_length: query.length,
      internal_count: internalEvents.length,
      external_count: externalEvents.length,
      tier1_latency_ms: tier1Latency,
      tier2_latency_ms: tier2Latency,
      db_error: dbError,
    })

    if (results.total === 0 && dbError) {
      return NextResponse.json(
        {
          error: "We couldn't reach Eventa right now. Try again.",
          error_code: "ERR_DB_CONNECT",
        },
        { status: 503 },
      )
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("[v0] Search error:", error)
    return NextResponse.json(
      {
        error: "Failed to search events",
        error_code: "ERR_SEARCH_FAILED",
      },
      { status: 500 },
    )
  }
}
