export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateICS } from "@/lib/ical"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const event = await db.event.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        city: true,
        country: true,
        venueName: true,
        address: true,
        externalUrl: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const icsContent = generateICS(event)

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar;charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics"`,
      },
    })
  } catch (error) {
    console.error("Error generating iCal:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
