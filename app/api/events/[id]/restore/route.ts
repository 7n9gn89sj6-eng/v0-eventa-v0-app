import { type NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"                           // <-- FIXED IMPORT
import { getSession } from "@/lib/jwt"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // FIX: correct ownership check
    if (event.createdById !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Restore the event to PUBLISHED
    const restoredEvent = await db.event.update({
      where: { id },
      data: { status: "PUBLISHED" },
    })

    return NextResponse.json({ event: restoredEvent })
  } catch (error) {
    console.error("Error restoring event:", error)
    return NextResponse.json({ error: "Failed to restore event" }, { status: 500 })
  }
}
