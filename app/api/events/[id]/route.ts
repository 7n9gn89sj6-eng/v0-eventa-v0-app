import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/jwt"
import { validateEventEditToken } from "@/lib/eventEditToken"
import { ok, fail } from "@/lib/http"

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

    // Extract token from Authorization header or query parameter
    const authHeader = request.headers.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null
    const queryToken = request.nextUrl.searchParams.get("token")
    const editToken = bearerToken || queryToken

    let isAuthorized = false
    let isOwner = false

    // Fetch the event first to check ownership and end time
    const event = await db.event.findUnique({
      where: { id },
      select: {
        createdById: true,
        endAt: true,
        startAt: true,
      },
    })

    if (!event) {
      return fail("Event not found", 404)
    }

    // Check if event has ended (block edits after event ends)
    const now = new Date()
    if (event.endAt && now > event.endAt) {
      return fail("Cannot edit event after it has ended", 403)
    }

    // Try session-based authentication first (existing owner flow)
    const session = await getSession()
    if (session && event.createdById === session.userId) {
      isAuthorized = true
      isOwner = true
    }

    // If not authorized via session, try token-based authentication
    if (!isAuthorized && editToken) {
      const tokenValidation = await validateEventEditToken(id, editToken)

      if (tokenValidation === "ok") {
        isAuthorized = true
      } else if (tokenValidation === "expired") {
        return fail("token_expired", 401)
      } else {
        return fail("Invalid edit token", 401)
      }
    }

    // If still not authorized, return 401
    if (!isAuthorized) {
      return fail("Unauthorized", 401)
    }

    // Validate dates if provided
    const startAt = body.startAt ? new Date(body.startAt) : event.startAt
    const endAt = body.endAt ? new Date(body.endAt) : event.endAt

    if (startAt && endAt && endAt <= startAt) {
      return fail("End time must be after start time", 400)
    }

    // Update event with allowed fields
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
      },
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
