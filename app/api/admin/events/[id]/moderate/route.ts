import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { action, notes, adminId, reason } = await request.json()

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (action === "reject" && !reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
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

    const updatedEvent = await db.event.update({
      where: { id },
      data: {
        moderationStatus: newStatus,
        moderatedAt: new Date(),
        moderatedBy: adminId,
        status: action === "approve" ? "PUBLISHED" : "ARCHIVED",
        aiStatus: action === "approve" ? "SAFE" : "REJECTED",
        publishedAt: action === "approve" ? new Date() : null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: action === "reject" ? reason : undefined,
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
        reason: action === "reject" ? reason : (notes || `Event ${action}d by admin`),
      },
    })

    if (action === "reject") {
      console.log("[v0] Email disabled - Would have sent rejection email to:", event.createdBy.email)
    }

    return NextResponse.json({ success: true, event: updatedEvent })
  } catch (error) {
    console.error("Error moderating event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
