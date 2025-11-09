export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true, id: true, email: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { id } = await params
    const { action, notes, adminId } = await request.json()

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const event = await db.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED"
    const oldStatus = event.moderationStatus

    // Update event moderation status
    const updatedEvent = await db.event.update({
      where: { id },
      data: {
        moderationStatus: newStatus,
        moderatedAt: new Date(),
        moderatedBy: adminId,
        status: action === "approve" ? "PUBLISHED" : "DRAFT",
      },
    })

    // Create audit log entry
    await db.eventAuditLog.create({
      data: {
        eventId: id,
        actor: "admin",
        actorId: adminId,
        action: action === "approve" ? "approved" : "rejected",
        oldStatus,
        newStatus,
        notes,
        reason: notes || `Event ${action}d by admin`,
      },
    })

    // Send email notification to creator if rejected
    if (action === "reject") {
      try {
        await sendEmail({
          to: event.createdBy.email,
          subject: `Event Rejected: ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Event Rejected</h2>
              
              <p>Hello ${event.createdBy.name || "there"},</p>
              
              <p>Unfortunately, your event submission has been rejected by our moderation team.</p>
              
              <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; font-weight: bold;">Event: ${event.title}</p>
                ${event.moderationReason ? `<p style="margin: 8px 0 0 0;">Reason: ${event.moderationReason}</p>` : ""}
                ${notes ? `<p style="margin: 8px 0 0 0;">Additional Notes: ${notes}</p>` : ""}
              </div>
              
              <p>If you believe this decision was made in error, you can appeal this decision by editing your event and resubmitting it with the necessary changes.</p>
              
              <p>Thank you for your understanding.</p>
            </div>
          `,
        })
      } catch (emailError) {
        console.error("[v0] Failed to send rejection email:", emailError)
      }
    }

    return NextResponse.json({ success: true, event: updatedEvent })
  } catch (error) {
    console.error("Error moderating event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
