export const runtime = "nodejs"

import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/jwt"
import { validateEventEditToken } from "@/lib/eventEditToken"
import { ok, fail } from "@/lib/http"
import { createAuditLog } from "@/lib/audit-log"
import { moderateEventContent } from "@/lib/ai-moderation"
import { notifyAdminOfFlaggedEvent } from "@/lib/admin-notifications"
import { sendEmail } from "@/lib/email"

// ---------------------------------------------------------
// GET EVENT (PUBLIC)
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// OWNER-ONLY PATCH
// ---------------------------------------------------------
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) {
      return fail("Unauthorized", 401)
    }

    const { id } = params
    const body = await request.json()

    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    })

    if (!event) return fail("Event not found", 404)
    if (event.createdById !== session.userId) return fail("Forbidden", 403)

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
    console.error("[v0] PATCH error:", error)
    return fail("Failed to update event", 500)
  }
}

// ---------------------------------------------------------
// FULL PUT (OWNER OR TOKEN OR CONFIRMED)
// ---------------------------------------------------------
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()

    // Tokens from header or query
    const authHeader = request.headers.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null
    const queryToken = request.nextUrl.searchParams.get("token")
    const confirmed = request.nextUrl.searchParams.get("confirmed") === "true"

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
          select: { email: true, name: true },
        },
      },
    })

    if (!event) return fail("Event not found", 404)

    // Disallow edits after event ends
    const now = new Date()
    if (event.endAt && now > event.endAt) {
      return fail("Cannot edit event after it has ended", 403)
    }

    // 1. OWNER SESSION
    const session = await getSession()
    if (session && event.createdById === session.userId) {
      isAuthorized = true
      isOwner = true
      userId = session.userId
    }

    // 2. CONFIRMED ACCESS ("?confirmed=true")
    if (!isAuthorized && confirmed) {
      isAuthorized = true
      userId = event.createdById
    }

    // 3. EDIT TOKEN
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

    // Basic validation
    const startAt = body.startAt ? new Date(body.startAt) : event.startAt
    const endAt = body.endAt ? new Date(body.endAt) : event.endAt

    if (startAt && endAt && endAt <= startAt) {
      return fail("End time must be after start time", 400)
    }

    const oldStatus = event.moderationStatus

    // Update event
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
    })

    // Logging
    await createAuditLog({
      eventId: id,
      actor: isOwner ? "user" : "external",
      actorId: userId,
      action: "edited",
      oldStatus,
      newStatus: "PENDING",
      notes: "Event edited and re-submitted for moderation",
    })

    // Trigger moderation in background
    moderateEventContent({
      title: body.title,
      description: body.description,
      city: body.city,
      country: body.country,
      externalUrl: body.externalUrl,
    })
      .then(async (result) => {
        const newStatus = result.status.toUpperCase()

        await db.event.update({
          where: { id },
          data: {
            moderationStatus: newStatus as any,
            moderationReason: result.reason,
            moderationSeverity: result.severity_level.toUpperCase() as any,
            moderationCategory: result.policy_category,
            moderatedAt: new Date(),
          },
        })

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
          newStatus,
          reason: result.reason,
          notes: `AI moderation: ${result.policy_category}`,
        })

        // Notify admin + email on reject
        if (result.status === "flagged" || result.status === "rejected") {
          await notifyAdminOfFlaggedEvent({
            id,
            title: body.title,
            description: body.description,
            moderationStatus: newStatus,
            moderationReason: result.reason,
            moderationSeverity: result.severity_level.toUpperCase(),
            moderationCategory: result.policy_category,
          })

          if (result.status === "rejected") {
            try {
              await sendEmail({
                to: event.createdBy.email,
                subject: `Event Rejected: ${body.title}`,
                html: `
                  <h2 style="color:#dc2626">Event Rejected</h2>
                  <p>Hello ${event.createdBy.name || ""},</p>
                  <p>Your event was rejected after editing.</p>
                  <p><strong>Reason:</strong> ${result.reason}</p>
                `,
              })
            } catch (e) {
              console.error("Failed to send rejection email", e)
            }
          }
        }
      })
      .catch((err) => console.error("Moderation error:", err))

    return ok({ event: updatedEvent })
  } catch (error) {
    console.error("[v0] PUT error:", error)
    return fail("Failed to update event", 500)
  }
}

// ---------------------------------------------------------
// DELETE
// ---------------------------------------------------------
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session) return fail("Unauthorized", 401)

    const { id } = params

    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    })

    if (!event) return fail("Event not found", 404)
    if (event.createdById !== session.userId) return fail("Forbidden", 403)

    await db.event.delete({ where: { id } })

    return ok({ ok: true })
  } catch (error) {
    console.error("[v0] DELETE error:", error)
    return fail("Failed to delete event", 500)
  }
}
