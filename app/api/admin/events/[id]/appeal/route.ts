import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit-log"
import { sendEmail } from "@/lib/email"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { id } = await params
    const { appealId, action, reviewNotes } = await request.json()

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const appeal = await db.eventAppeal.findUnique({
      where: { id: appealId },
      include: {
        event: {
          include: {
            createdBy: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!appeal || appeal.eventId !== id) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 })
    }

    // Update appeal status
    const updatedAppeal = await db.eventAppeal.update({
      where: { id: appealId },
      data: {
        status: action === "approve" ? "approved" : "rejected",
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        reviewNotes,
      },
    })

    // If approved, update event moderation status
    if (action === "approve") {
      await db.event.update({
        where: { id },
        data: {
          moderationStatus: "APPROVED",
          status: "PUBLISHED",
          moderatedAt: new Date(),
          moderatedBy: session.userId,
        },
      })

      await createAuditLog({
        eventId: id,
        actor: "admin",
        actorId: session.userId,
        action: "approved",
        oldStatus: "REJECTED",
        newStatus: "APPROVED",
        notes: `Appeal approved: ${reviewNotes || "No notes provided"}`,
      })
    } else {
      await createAuditLog({
        eventId: id,
        actor: "admin",
        actorId: session.userId,
        action: "appeal_rejected",
        notes: `Appeal rejected: ${reviewNotes || "No notes provided"}`,
      })
    }

    // Notify user of appeal decision
    try {
      await sendEmail({
        to: appeal.user.email,
        subject: `Appeal ${action === "approve" ? "Approved" : "Rejected"}: ${appeal.event.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${action === "approve" ? "#16a34a" : "#dc2626"};">
              Appeal ${action === "approve" ? "Approved" : "Rejected"}
            </h2>
            
            <p>Hello ${appeal.user.name || "there"},</p>
            
            <p>Your appeal for the event "${appeal.event.title}" has been ${action === "approve" ? "approved" : "rejected"}.</p>
            
            ${
              reviewNotes
                ? `
              <div style="background: #f3f4f6; border-left: 4px solid ${action === "approve" ? "#16a34a" : "#dc2626"}; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; font-weight: bold;">Admin Notes:</p>
                <p style="margin: 8px 0 0 0;">${reviewNotes}</p>
              </div>
            `
                : ""
            }
            
            ${
              action === "approve"
                ? `
              <p>Your event is now published and visible to the public.</p>
            `
                : `
              <p>If you have further questions, please contact support.</p>
            `
            }
          </div>
        `,
      })
    } catch (emailError) {
      console.error("[v0] Failed to send appeal decision email:", emailError)
    }

    return NextResponse.json({ success: true, appeal: updatedAppeal })
  } catch (error) {
    console.error("Error processing appeal:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
