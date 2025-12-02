import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { createEventEditToken } from "@/lib/eventEditToken"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    const { id: eventId } = params

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

    const body = await request.json().catch(() => ({}))
    const sendEmail = body.sendEmail === true

    let emailSent = false
    let emailError = ""
    
    if (sendEmail && event.createdBy?.email) {
      const { sendEventEditLinkEmail } = await import("@/lib/email")
      const emailResult = await sendEventEditLinkEmail(
        event.createdBy.email,
        event.title,
        event.id,
        token
      )
      
      if (emailResult.success) {
        console.log("[v0] Edit link email sent to:", event.createdBy.email)
        emailSent = true
      } else {
        console.error("[v0] Failed to send regeneration email:", emailResult.error)
        emailError = emailResult.error
      }
    }

    return NextResponse.json({
      token,
      editUrl,
      emailSent,
      ...(emailError && { emailError }),
    })
  } catch (error) {
    console.error("[v0] Error regenerating edit token:", error)
    return NextResponse.json({ error: "Failed to regenerate edit token" }, { status: 500 })
  }
}
