import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import db from "@/lib/db"
import { createEventEditToken } from "@/lib/eventEditToken"
import { sendEventEditLinkEmailAPI } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: eventId } = await params

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

    // Use request origin for edit URL (works in production)
    // Falls back to NEXT_PUBLIC_APP_URL or localhost if not available
    const baseUrl = request.nextUrl.origin
    const editUrl = `${baseUrl}/edit/${event.id}?token=${token}`

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
        token,
        baseUrl // Pass baseUrl to use request origin
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

