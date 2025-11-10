export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/jwt"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify the event belongs to the user
    const event = await db.event.findUnique({
      where: { id },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (event.userId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Archive the event
    const archivedEvent = await db.event.update({
      where: { id },
      data: { status: "ARCHIVED" },
    })

    return NextResponse.json({ event: archivedEvent })
  } catch (error) {
    console.error("Error archiving event:", error)
    return NextResponse.json({ error: "Failed to archive event" }, { status: 500 })
  }
}
