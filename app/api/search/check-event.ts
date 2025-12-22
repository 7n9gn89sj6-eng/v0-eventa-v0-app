import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("id")
  
  if (!eventId) {
    return NextResponse.json({ error: "Event ID required" }, { status: 400 })
  }
  
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        description: true,
        city: true,
        country: true,
        status: true,
        moderationStatus: true,
        aiStatus: true,
        startAt: true,
        endAt: true,
        searchText: true,
        createdAt: true,
      },
    })
    
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }
    
    const matchesPublic = event.status === "PUBLISHED" && event.moderationStatus === "APPROVED"
    const isFuture = new Date(event.startAt) > new Date()
    
    return NextResponse.json({
      event,
      visibility: {
        matchesPublicWhere: matchesPublic,
        isFuture,
        wouldAppearInSearch: matchesPublic && isFuture,
        status: event.status,
        moderationStatus: event.moderationStatus,
        aiStatus: event.aiStatus,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

