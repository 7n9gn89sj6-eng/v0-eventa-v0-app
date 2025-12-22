import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"

/**
 * GET: Check event status and visibility
 * POST: Fix event status if it's approved but missing moderationStatus
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const eventId = params.id

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        city: true,
        country: true,
        status: true,
        moderationStatus: true,
        aiStatus: true,
        startAt: true,
        searchText: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const matchesPublic = event.status === "PUBLISHED" && event.moderationStatus === "APPROVED"
    const isFuture = new Date(event.startAt) > new Date()
    const wouldAppearInSearch = matchesPublic && isFuture

    return NextResponse.json({
      event,
      visibility: {
        matchesPublicWhere: matchesPublic,
        isFuture,
        wouldAppearInSearch,
        status: event.status,
        moderationStatus: event.moderationStatus,
        aiStatus: event.aiStatus,
        publicEventWhere: PUBLIC_EVENT_WHERE,
      },
      fixable: event.status === "PUBLISHED" && event.aiStatus === "SAFE" && event.moderationStatus !== "APPROVED",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST: Fix event moderationStatus if it's approved but missing the status
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const eventId = params.id

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        status: true,
        moderationStatus: true,
        aiStatus: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Only fix if event is PUBLISHED and SAFE but missing APPROVED
    if (event.status === "PUBLISHED" && event.aiStatus === "SAFE" && event.moderationStatus !== "APPROVED") {
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: {
          moderationStatus: "APPROVED",
        },
      })

      return NextResponse.json({
        success: true,
        message: "Event moderationStatus updated to APPROVED",
        event: {
          id: updated.id,
          title: updated.title,
          status: updated.status,
          moderationStatus: updated.moderationStatus,
          aiStatus: updated.aiStatus,
        },
      })
    } else {
      return NextResponse.json({
        success: false,
        message: "Event does not need fixing or cannot be auto-fixed",
        event: {
          id: event.id,
          status: event.status,
          moderationStatus: event.moderationStatus,
          aiStatus: event.aiStatus,
        },
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

