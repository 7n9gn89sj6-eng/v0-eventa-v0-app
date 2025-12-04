import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { db } from "@/lib/db";
import { notifyAdminsEventUpdated } from "@/lib/admin-notifications";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true, email: true, id: true },
    });

    if (!admin?.isAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { eventIds, action } = await req.json();

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { error: "No event IDs provided" },
        { status: 400 }
      );
    }

    const validActions = [
      "approve",
      "reject",
      "needs_review",
      "publish",
      "unpublish",
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let updates: any = {};
    let logAction: string;

    if (action === "approve") {
      updates = { status: "PUBLISHED", aiStatus: "SAFE" };
      logAction = "ADMIN_APPROVED";
    } else if (action === "reject") {
      updates = { status: "DRAFT", aiStatus: "REJECTED" };
      logAction = "ADMIN_REJECTED";
    } else if (action === "needs_review") {
      updates = { status: "PENDING", aiStatus: "NEEDS_REVIEW" };
      logAction = "ADMIN_MARKED_NEEDS_REVIEW";
    } else if (action === "publish") {
      updates = { status: "PUBLISHED" };
      logAction = "ADMIN_PUBLISHED";
    } else {
      updates = { status: "DRAFT" };
      logAction = "ADMIN_UNPUBLISHED";
    }

    const results = [];

    for (const id of eventIds) {
      const updated = await db.event.update({
        where: { id },
        data: {
          ...updates,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      });

      await db.eventAuditLog.create({
        data: {
          eventId: id,
          userId: admin.id,
          action: logAction,
          reason: "Bulk moderation",
        },
      });

      await notifyAdminsEventUpdated({
        eventId: updated.id,
        title: updated.title,
        action: logAction,
        adminEmail: admin.email,
        reason: "Bulk moderation",
      });

      results.push(updated);
    }

    return NextResponse.json({ success: true, updated: results });
  } catch (err) {
    console.error("Bulk moderation error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
