export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const runtime = "nodejs"

import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/jwt"
import { validateEventEditToken } from "@/lib/eventEditToken"
import { ok, fail } from "@/lib/http"
import { createAuditLog } from "@/lib/audit-log"
import { moderateEventContent } from "@/lib/ai-moderation"
import { notifyAdminOfFlaggedEvent } from "@/lib/admin-notifications"
import { sendEmail } from "@/lib/email.server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const event = await db.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!event) {
      return fail("Event not found", 404)
    }

    return ok({ event })
  } catch (error) {
    console.error("Error fetching event:", error)
    return fail("Failed to fetch event", 500)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) {
      return fail("Unauthorized", 401)
    }

    const { id } = params
    const body = await request.json()

    // Verify ownership
    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    })

    if (!event) {
      return fail("Event not found", 404)
    }

    if (event.createdById !== session.userId) {
      return fail("Forbidden", 403)
    }

    // Update event with allowed fields
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
    })

    return ok({ event: updatedEvent })
  } catch (error) {
    console.error("[v0] Error updating event:", error)
    return fail("Failed to update event", 500)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()

    const authHeader = request.headers.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null
    const queryToken = request.nextUrl.searchParams.get("token")
    const editToken = bearerToken || queryToken

    let isAuthorized = false
    let isOwner = false
    let userId: string | undefined

    const event = await db.event.findUnique({
      where: { id },
      select: {
        createdById: true,
        endAt: true,
        startAt: true,
        moderationStatus: true,
        title: true,
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!event) {
      return fail("Event not found", 404)
    }

    const now = new Date()
    if (event.endAt && now > event.endAt) {
      return fail("Cannot edit event after it has ended", 403)
    }

    const session = await getSession()
    if (session && event.createdById === session.userId) {
      isAuthorized = true
      isOwner = true
      userId = session.userId
    }

    if (!isAuthorized && editToken) {
      const tokenValidation = await validateEventEditToken(id, editToken)

      if (tokenValidation === "ok") {
        isAuthorized = true
        userId = event.createdById
      } else if (tokenValidation === "expired") {
        return fail("token_expired", 401)
      } else {
        return fail("Invalid edit token", 401)
      }
    }

    if (!isAuthorized) {
      return fail("Unauthorized", 401)
    }

    const startAt = body.startAt ? new Date(body.startAt) : event.startAt
    const endAt = body.endAt ? new Date(body.endAt) : event.endAt

    if (startAt && endAt && endAt <= startAt) {
      return fail("End time must be after start time", 400)
    }

    const oldStatus = event.moderationStatus

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
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
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
    })

    await createAuditLog({
      eventId: id,
      actor: "user",
      actorId: userId,
      action: "edited",
      oldStatus,
      newStatus: "PENDING",
      notes: "Event edited and resubmitted for moderation",
    })

    moderateEventContent({
      title: body.title,
      description: body.description,
      city: body.city,
      country: body.country,
      externalUrl: body.externalUrl,
    })
      .then(async (moderationResult) => {
        const newStatus = moderationResult.status.toUpperCase()

        await db.event.update({
          where: { id },
          data: {
            moderationStatus: newStatus as any,
            moderationReason: moderationResult.reason,
            moderationSeverity: moderationResult.severity_level.toUpperCase() as any,
            moderationCategory: moderationResult.policy_category,
            moderatedAt: new Date(),
          },
        })

        await createAuditLog({
          eventId: id,
          actor: "ai",
          action:
            moderationResult.status === "approved"
              ? "approved"
              : moderationResult.status === "rejected"
                ? "rejected"
                : "flagged",
          oldStatus: "PENDING",
          newStatus,
          reason: moderationResult.reason,
          notes: `AI re-moderation after edit: ${moderationResult.policy_category}`,
        })

        if (moderationResult.status === "flagged" || moderationResult.status === "rejected") {
          await notifyAdminOfFlaggedEvent({
            id,
            title: body.title,
            description: body.description,
            moderationStatus: newStatus,
            moderationReason: moderationResult.reason,
            moderationSeverity: moderationResult.severity_level.toUpperCase(),
            moderationCategory: moderationResult.policy_category,
          })

          if (moderationResult.status === "rejected") {
            try {
              await sendEmail({
                to: event.createdBy.email,
                subject: `Event Rejected: ${body.title}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">Event Rejected After Edit</h2>
                    
                    <p>Hello ${event.createdBy.name || "there"},</p>
                    
                    <p>Your edited event submission has been rejected by our moderation system.</p>
                    
                    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">
                      <p style="margin: 0; font-weight: bold;">Event: ${body.title}</p>
                      <p style="margin: 8px 0 0 0;">Reason: ${moderationResult.reason}</p>
                    </div>
                    
                    <p>You can edit your event again and resubmit it for review.</p>
                  </div>
                `,
              })
            } catch (emailError) {
              console.error("[v0] Failed to send rejection email:", emailError)
            }
          }
        }
      })
      .catch((error) => {
        console.error("[v0] Re-moderation failed:", error)
      })

    return ok({ event: updatedEvent })
  } catch (error) {
    console.error("[v0] Error updating event:", error)
    return fail("Failed to update event", 500)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) {
      return fail("Unauthorized", 401)
    }

    const { id } = params

    // Verify ownership
    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    })

    if (!event) {
      return fail("Event not found", 404)
    }

    if (event.createdById !== session.userId) {
      return fail("Forbidden", 403)
    }

    await db.event.delete({
      where: { id },
    })

    return ok({ ok: true })
  } catch (error) {
    console.error("[v0] Error deleting event:", error)
    return fail("Failed to delete event", 500)
  }
}
