import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
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

    const { action, ids, reason } = await request.json()

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No event IDs provided" }, { status: 400 })
    }

    if (action === "reject" && !reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    // Fetch events to be updated
    const events = await db.event.findMany({
      where: { id: { in: ids } },
      include: {
        createdBy: {
          select: { email: true, name: true },
        },
      },
    })

    if (events.length === 0) {
      return NextResponse.json({ error: "No events found" }, { status: 404 })
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED"

    // Bulk update all events
    await db.event.updateMany({
      where: { id: { in: ids } },
      data: {
        moderationStatus: newStatus,
        moderatedAt: new Date(),
        moderatedBy: user.id,
        status: action === "approve" ? "PUBLISHED" : "ARCHIVED",
        aiStatus: action === "approve" ? "SAFE" : "REJECTED",
        publishedAt: action === "approve" ? new Date() : null,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        adminNotes: action === "reject" ? reason : undefined,
      },
    })

    // Create audit log entries for each event
    await Promise.all(
      events.map((event) =>
        db.eventAuditLog.create({
          data: {
            eventId: event.id,
            actor: "admin",
            actorId: user.id,
            action: action === "approve" ? "bulk_approved" : "bulk_rejected",
            oldStatus: event.moderationStatus,
            newStatus,
            notes: reason || `Event ${action}d by admin (bulk action)`,
            reason: reason || undefined,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      count: events.length,
      message: `${events.length} event(s) ${action}d successfully`,
    })
  } catch (error) {
    console.error("Error bulk moderating events:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
