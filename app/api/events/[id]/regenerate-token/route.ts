import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { createEventEditToken } from "@/lib/eventEditToken"
import { sendEventEditLinkEmail } from "@/lib/email"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    const { id: eventId } = await params

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Get the event
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        createdBy: {
          select: { email: true, name: true },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Generate new token
    const token = await createEventEditToken(event.id, event.endAt)

    // Construct edit URL
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
    const editUrl = `${baseUrl}/my/events/${event.id}/edit?token=${token}`

    // Parse request body to check if email should be sent
    const body = await request.json().catch(() => ({ sendEmail: false }))
    let emailSent = false

    if (body.sendEmail) {
      try {
        await sendEventEditLinkEmail(event.createdBy.email, event.title, event.id, token)
        emailSent = true
      } catch (error) {
        console.error("[v0] Failed to send regenerated edit link email:", error)
      }
    }

    return NextResponse.json({
      token,
      editUrl,
      emailSent,
    })
  } catch (error) {
    console.error("[v0] Error regenerating edit token:", error)
    return NextResponse.json({ error: "Failed to regenerate edit token" }, { status: 500 })
  }
}
