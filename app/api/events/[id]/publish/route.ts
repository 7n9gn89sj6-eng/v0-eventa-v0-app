import { type NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"                         // <-- FIXED HERE
import { getSession } from "@/lib/jwt"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    // Verify ownership and get event
    const event = await db.event.findUnique({
      where: { id },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (event.createdById !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Validate required fields for publishing
    if (!event.title || !event.description || !event.startAt || !event.city || !event.country) {
      return NextResponse.json(
        {
          error: "Cannot publish: missing required fields (title, description, startAt, city, country)",
        },
        { status: 400 }
      )
    }

    // Publish the event
    const publishedEvent = await db.event.update({
      where: { id },
      data: { status: "PUBLISHED" },
    })

    return NextResponse.json({ event: publishedEvent })
  } catch (error) {
    console.error("[v0] Error publishing event:", error)
    return NextResponse.json({ error: "Failed to publish event" }, { status: 500 })
  }
}
