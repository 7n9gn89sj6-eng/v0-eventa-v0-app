// app/api/admin/events/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit-log";
import { notifyAdminsEventUpdated } from "@/lib/admin-notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, isAdmin: true },
    });

    if (!admin?.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { action, reason } = await request.json();

    const validActions = [
      "approve",
      "reject",
      "needs_review",
      "publish",
      "unpublish",
    ] as const;

    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const event = await db.event.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        status: true,
        moderationStatus: true,
        publishedAt: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const oldModerationStatus = event.moderationStatus;
    const oldStatus = event.status;
    const now = new Date();

    let updated = event;

    /* ---------------------------------------------------------
       APPROVE → PUBLISHED + SAFE + APPROVED
    --------------------------------------------------------- */
    if (action === "approve") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "PUBLISHED",
          aiStatus: "SAFE",
          aiReason: reason ?? "Approved by admin",
          moderationStatus: "APPROVED",
          moderatedAt: now,
          moderatedBy: admin.id,
          reviewedBy: admin.id,
          reviewedAt: now,
          publishedAt: event.publishedAt ?? now,
        },
      });

      await createAuditLog({
        eventId: params.id,
        actor: "admin",
        actorId: admin.id,
        action: "ADMIN_APPROVED",
        oldStatus: oldModerationStatus,
        newStatus: "APPROVED",
        reason: reason ?? "Approved by admin",
        notes: "Admin approved event and published",
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_APPROVED",
        adminEmail: admin.email,
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
          moderationStatus: "REJECTED",
          moderatedAt: now,
          moderatedBy: admin.id,
          reviewedBy: admin.id,
          reviewedAt: now,
        },
      });

      await createAuditLog({
        eventId: params.id,
        actor: "admin",
        actorId: admin.id,
        action: "ADMIN_REJECTED",
        oldStatus: oldModerationStatus,
        newStatus: "REJECTED",
        reason: reason ?? "Rejected by admin",
        notes: "Admin rejected event",
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_REJECTED",
        adminEmail: admin.email,
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
          moderationStatus: "FLAGGED",
          moderatedAt: now,
          moderatedBy: admin.id,
          reviewedBy: admin.id,
          reviewedAt: now,
        },
      });

      await createAuditLog({
        eventId: params.id,
        actor: "admin",
        actorId: admin.id,
        action: "ADMIN_MARKED_NEEDS_REVIEW",
        oldStatus: oldModerationStatus,
        newStatus: "FLAGGED",
        reason: reason ?? "Marked for manual review",
        notes: "Admin flagged event for manual review",
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_MARKED_NEEDS_REVIEW",
        adminEmail: admin.email,
        reason,
      });
    }

    /* ---------------------------------------------------------
       PUBLISH (override) → just change status/publishedAt
    --------------------------------------------------------- */
    else if (action === "publish") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "PUBLISHED",
          publishedAt: event.publishedAt ?? now,
        },
      });

      await createAuditLog({
        eventId: params.id,
        actor: "admin",
        actorId: admin.id,
        action: "ADMIN_PUBLISHED",
        oldStatus,
        newStatus: "PUBLISHED",
        reason: reason ?? "Published by admin override",
        notes: "Admin forced publish",
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_PUBLISHED",
        adminEmail: admin.email,
        reason,
      });
    }

    /* ---------------------------------------------------------
       UNPUBLISH → DRAFT (keep AI + moderation state)
    --------------------------------------------------------- */
    else if (action === "unpublish") {
      updated = await db.event.update({
        where: { id: params.id },
        data: {
          status: "DRAFT",
        },
      });

      await createAuditLog({
        eventId: params.id,
        actor: "admin",
        actorId: admin.id,
        action: "ADMIN_UNPUBLISHED",
        oldStatus,
        newStatus: "DRAFT",
        reason: reason ?? "Unpublished by admin",
        notes: "Admin unpublished event",
      });

      await notifyAdminsEventUpdated({
        eventId: params.id,
        title: updated.title,
        action: "ADMIN_UNPUBLISHED",
        adminEmail: admin.email,
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
