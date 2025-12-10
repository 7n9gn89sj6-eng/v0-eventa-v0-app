// app/api/events/[id]/route.ts
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import db from "@/lib/db";                  // << FIXED HERE
import { getSession } from "@/lib/jwt";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { ok, fail } from "@/lib/http";
import { createAuditLog } from "@/lib/audit-log";
import { moderateEventContent } from "@/lib/ai-moderation";
import { sendEmailAPI } from "@/lib/email";
import { notifyAdminsEventNeedsReview } from "@/lib/admin-notifications";

/* ----------------------------------------------------------
   GET — fetch event (public)
---------------------------------------------------------- */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!event) {
      return fail("Event not found", 404);
    }

    return ok({ event });
  } catch (error) {
    console.error("Error fetching event:", error);
    return fail("Failed to fetch event", 500);
  }
}

/* ----------------------------------------------------------
   PATCH — owner updates fields (but NOT trigger re-moderation)
---------------------------------------------------------- */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { id } = params;
    const body = await request.json();

    // Verify ownership
    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!event) return fail("Event not found", 404);
    if (event.createdById !== session.userId) return fail("Forbidden", 403);

    const updatedEvent = await db.event.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        locationAddress: body.locationAddress,
        city: body.city,
        country: body.country,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
        imageUrl: body.imageUrl,
        externalUrl: body.externalUrl,
      },
    });

    return ok({ event: updatedEvent });
  } catch (error) {
    console.error("[v0] Error updating event:", error);
    return fail("Failed to update event", 500);
  }
}

/* ----------------------------------------------------------
   PUT — FULL EDIT (owner OR edit-token) + AI Moderation
---------------------------------------------------------- */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();

    /* ------------------ AUTH ------------------ */
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const queryToken = request.nextUrl.searchParams.get("token");
    const editToken = bearerToken || queryToken;

    let isAuthorized = false;
    let isOwner = false;
    let userId: string | undefined;

    const event = await db.event.findUnique({
      where: { id },
      select: {
        createdById: true,
        endAt: true,
        startAt: true,
        moderationStatus: true,
        title: true,
        createdBy: { select: { email: true, name: true } },
      },
    });

    if (!event) return fail("Event not found", 404);

    // Check if event expired
    const now = new Date();
    if (event.endAt && now > event.endAt) {
      return fail("Cannot edit event after it has ended", 403);
    }

    // Auth via session → owner?
    const session = await getSession();
    if (session && session.userId === event.createdById) {
      isAuthorized = true;
      isOwner = true;
      userId = session.userId;
    }

    // Auth via token
    if (!isAuthorized && editToken) {
      const tokenValidation = await validateEventEditToken(id, editToken);
      if (tokenValidation === "ok") {
        isAuthorized = true;
        userId = event.createdById;
      } else if (tokenValidation === "expired") {
        return fail("token_expired", 401);
      } else {
        return fail("Invalid edit token", 401);
      }
    }

    if (!isAuthorized) return fail("Unauthorized", 401);

    /* ------------------ VALIDATION ------------------ */
    const startAt = body.startAt ? new Date(body.startAt) : event.startAt;
    const endAt = body.endAt ? new Date(body.endAt) : event.endAt;

    if (startAt && endAt && endAt <= startAt) {
      return fail("End time must be after start time", 400);
    }

    const oldStatus = event.moderationStatus;

    /* ------------------ UPDATE EVENT ------------------ */
    const updatedEvent = await db.event.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        venueName: body.venueName,
        locationAddress: body.locationAddress,
        address: body.address,
        city: body.city,
        country: body.country,
        startAt,
        endAt,
        imageUrl: body.imageUrl,
        externalUrl: body.externalUrl,
        contactEmail: body.contactEmail,
        categories: body.categories,
        languages: body.languages,

        moderationStatus: "PENDING",
        moderationReason: null,
        moderationSeverity: null,
        moderationCategory: null,
        moderatedAt: null,
        moderatedBy: null,
      },
    });

    /* ------------------ AUDIT LOG ------------------ */
    await createAuditLog({
      eventId: id,
      actor: "user",
      actorId: userId,
      action: "edited",
      oldStatus,
      newStatus: "PENDING",
      notes: "Event edited and re-submitted for AI moderation",
    });

    /* ------------------ AI MODERATION (ASYNC) ------------------ */
    moderateEventContent({
      title: body.title,
      description: body.description,
      city: body.city,
      country: body.country,
      categories: body.categories,
      languages: body.languages,
    })
      .then(async (result) => {
        const aiStatus = result.status.toUpperCase() as "APPROVED" | "FLAGGED" | "REJECTED";

        await db.event.update({
          where: { id },
          data: {
            moderationStatus: aiStatus,
            moderationReason: result.reason,
            moderationSeverity: result.severity_level.toUpperCase(),
            moderationCategory: result.policy_category,
            moderatedAt: new Date(),
          },
        });

        await createAuditLog({
          eventId: id,
          actor: "ai",
          action:
            result.status === "approved"
              ? "approved"
              : result.status === "rejected"
              ? "rejected"
              : "flagged",
          oldStatus: "PENDING",
          newStatus: aiStatus,
          reason: result.reason,
          notes: `AI moderation: ${result.policy_category}`,
        });

        if (result.status === "flagged") {
          try {
            await notifyAdminsEventNeedsReview({
              eventId: id,
              title: body.title,
              city: body.city,
              country: body.country,
              aiStatus: "NEEDS_REVIEW",
              aiReason: result.reason,
            });
          } catch (err) {
            console.error("[v0] Failed to notify admins:", err);
          }
        }

        if (result.status === "rejected") {
          try {
            await sendEmailAPI({
              to: event.createdBy.email,
              subject: `Event Rejected: ${body.title}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #dc2626;">Event Rejected After Edit</h2>
                  <p>Hello ${event.createdBy.name || "there"},</p>
                  <p>Your event has been rejected by the moderation system.</p>
                  <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px;">
                    <p style="margin:0;"><strong>Reason:</strong> ${result.reason}</p>
                  </div>
                  <p>You may edit and resubmit your event at any time.</p>
                </div>
              `,
            });
          } catch (err) {
            console.error("[v0] Failed to send rejection email:", err);
          }
        }
      })
      .catch(async (error) => {
        console.error("[v0] AI moderation failed:", error);

        const reason =
          error instanceof Error
            ? `AI moderation error: ${error.message}`
            : "Unknown AI error";

        await db.event.update({
          where: { id },
          data: {
            moderationStatus: "FLAGGED",
            moderationReason: reason,
            moderatedAt: new Date(),
          },
        });

        await createAuditLog({
          eventId: id,
          actor: "ai",
          action: "AI_MODERATION_FAILED",
          oldStatus: "PENDING",
          newStatus: "FLAGGED",
          reason,
          notes: "AI moderation failed — event flagged for manual review",
        });

        try {
          await notifyAdminsEventNeedsReview({
            eventId: id,
            title: body.title,
            city: body.city,
            country: body.country,
            aiStatus: "NEEDS_REVIEW",
            aiReason: reason,
          });
        } catch (err) {
          console.error("[v0] Failed to send admin notification:", err);
        }
      });

    return ok({ event: updatedEvent });
  } catch (error) {
    console.error("[v0] Error updating event:", error);
    return fail("Failed to update event", 500);
  }
}

/* ----------------------------------------------------------
   DELETE — owner only
---------------------------------------------------------- */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { id } = params;

    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!event) return fail("Event not found", 404);
    if (event.createdById !== session.userId) return fail("Forbidden", 403);

    await db.event.delete({ where: { id } });

    return ok({ ok: true });
  } catch (error) {
    console.error("[v0] Error deleting event:", error);
    return fail("Failed to delete event", 500);
  }
}
