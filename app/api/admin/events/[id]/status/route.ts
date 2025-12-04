import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { db } from "@/lib/db";
import { notifyAdminsEventUpdated } from "@/lib/admin-notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true, id: true, email: true },
    });

    if (!user?.isAdmin)
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );

    const { action, reason } = await request.json();
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

    let updated;

    /* ---------------------------------------------------------
       APPROVE → PUBLISHED + SAFE
    --------------------------------------------------------- */
    if (action === "approve") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "PUBLISHED",
          aiStatus: "SAFE",
          aiReason: reason ?? "Approved by admin",
          reviewedBy: user.id,
          reviewedAt: new Date(),
          publishedAt: new Date(),
        },
      });

      await db.eventAuditLog.create({
        data: {
          eventId: params.id,
          userId: user.id,
          action: "ADMIN_APPROVED",
          reason: reason ?? "Approved by admin",
        },
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_APPROVED",
        adminEmail: user.email,
        reason,
      });
    }

    /* ---------------------------------------------------------
       REJECT → DRAFT + REJECTED
    --------------------------------------------------------- */
    else if (action === "reject") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "DRAFT",
          aiStatus: "REJECTED",
          aiReason: reason ?? "Rejected by admin",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      await db.eventAuditLog.create({
        data: {
          eventId: params.id,
          userId: user.id,
          action: "ADMIN_REJECTED",
          reason: reason ?? "Rejected by admin",
        },
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_REJECTED",
        adminEmail: user.email,
        reason,
      });
    }

    /* ---------------------------------------------------------
       NEEDS REVIEW → PENDING + NEEDS_REVIEW
    --------------------------------------------------------- */
    else if (action === "needs_review") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "PENDING",
          aiStatus: "NEEDS_REVIEW",
          aiReason: reason ?? "Marked for manual review",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      await db.eventAuditLog.create({
        data: {
          eventId: params.id,
          userId: user.id,
          action: "ADMIN_MARKED_NEEDS_REVIEW",
          reason: reason ?? "Marked for manual review",
        },
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_MARKED_NEEDS_REVIEW",
        adminEmail: user.email,
        reason,
      });
    }

    /* ---------------------------------------------------------
       PUBLISH (Override)
    --------------------------------------------------------- */
    else if (action === "publish") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      await db.eventAuditLog.create({
        data: {
          eventId: params.id,
          userId: user.id,
          action: "ADMIN_PUBLISHED",
          reason: reason ?? "Published by admin override",
        },
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_PUBLISHED",
        adminEmail: user.email,
        reason,
      });
    }

    /* ---------------------------------------------------------
       UNPUBLISH → DRAFT (aiStatus unchanged)
    --------------------------------------------------------- */
    else if (action === "unpublish") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "DRAFT",
        },
      });

      await db.eventAuditLog.create({
        data: {
          eventId: params.id,
          userId: user.id,
          action: "ADMIN_UNPUBLISHED",
          reason: reason ?? "Unpublished by admin",
        },
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_UNPUBLISHED",
        adminEmail: user.email,
        reason,
      });
    }

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    console.error("Error updating event status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
