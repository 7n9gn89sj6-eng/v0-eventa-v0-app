import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { analyzeEventContent } from "@/lib/ai-moderation"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const event = await db.event.findUnique({
      where: { id: params.id },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const analysis = await analyzeEventContent({
      title: event.title,
      description: event.description,
      city: event.city,
      country: event.country,
    })

    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Error analyzing event:", error)
    return NextResponse.json({ error: "Failed to analyze event" }, { status: 500 })
  }
}
