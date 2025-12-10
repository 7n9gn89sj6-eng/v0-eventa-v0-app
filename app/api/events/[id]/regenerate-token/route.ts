import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import db from "@/lib/db"
import { createEventEditToken } from "@/lib/eventEditToken"
import { sendEventEditLinkEmailAPI } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const eventId = params.id

    // Admin required
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Fetch event
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

    // ----------- FIXED: correct edit URL ----------
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000"

    const editUrl = `${baseUrl}/events/${event.id}/edit?token=${token}`

    // Optional: regenerate + send email
    const body = await request.json().catch(() => ({}))
    const sendEmail = body.sendEmail === true

    let emailSent = false
    let emailError = ""

    if (sendEmail && event.createdBy?.email) {
      const result = await sendEventEditLinkEmailAPI(
        event.createdBy.email,
        event.title,
        event.id,
        token
      )

      if (result.success) {
        emailSent = true
      } else {
        emailError = result.error ?? "Failed to send email"
      }
    }

    return NextResponse.json({
      ok: true,
      token,
      editUrl,
      emailSent,
      ...(emailError && { emailError }),
    })
  } catch (error) {
    console.error("[v0] regenerate-token error:", error)
    return NextResponse.json(
      { error: "Failed to regenerate edit token" },
      { status: 500 }
    )
  }
}

