export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit-log"
import { sendEmail } from "@/lib/email"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const { reason } = await request.json()

    if (!reason || reason.length < 50) {
      return NextResponse.json({ error: "Appeal reason must be at least 50 characters" }, { status: 400 })
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

    if (event.createdById !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (event.moderationStatus !== "REJECTED") {
      return NextResponse.json({ error: "Can only appeal rejected events" }, { status: 400 })
    }

    // Check for existing pending appeal
    const existingAppeal = await db.eventAppeal.findFirst({
      where: {
        eventId: id,
        userId: session.userId,
        status: "pending",
      },
    })

    if (existingAppeal) {
      return NextResponse.json({ error: "You already have a pending appeal for this event" }, { status: 400 })
    }

    // Create appeal
    const appeal = await db.eventAppeal.create({
      data: {
        eventId: id,
        userId: session.userId,
        reason,
        status: "pending",
      },
    })

    // Create audit log
    await createAuditLog({
      eventId: id,
      actor: "user",
      actorId: session.userId,
      action: "appealed",
      notes: "User submitted appeal for rejected event",
    })

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `Appeal Submitted: ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Event Appeal Submitted</h2>
              
              <p>A user has submitted an appeal for a rejected event.</p>
              
              <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; font-weight: bold;">Event: ${event.title}</p>
                <p style="margin: 8px 0 0 0;">Submitted by: ${event.createdBy.name || event.createdBy.email}</p>
              </div>

              <h3>Appeal Reason:</h3>
              <p>${reason}</p>

              <h3>Original Rejection:</h3>
              <p><strong>Reason:</strong> ${event.moderationReason || "N/A"}</p>
              <p><strong>Category:</strong> ${event.moderationCategory || "N/A"}</p>

              <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <p style="margin: 0;"><strong>Action Required:</strong></p>
                <p style="margin: 8px 0 0 0;">
                  Please review this appeal in the admin dashboard.
                </p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/events/${id}" 
                   style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                  Review Appeal
                </a>
              </div>
            </div>
          `,
        })
      } catch (emailError) {
        console.error("[v0] Failed to send appeal notification:", emailError)
      }
    }

    return NextResponse.json({ success: true, appeal })
  } catch (error) {
    console.error("Error submitting appeal:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
