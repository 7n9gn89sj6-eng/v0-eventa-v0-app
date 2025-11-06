import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { DateTime } from "luxon"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const event = await db.event.findUnique({
      where: { id: params.id },
    })

    if (!event || event.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Generate .ics file content
    const startDate = DateTime.fromJSDate(new Date(event.startAt)).setZone(event.timezone).toFormat("yyyyMMdd'T'HHmmss")
    const endDate = DateTime.fromJSDate(new Date(event.endAt)).setZone(event.timezone).toFormat("yyyyMMdd'T'HHmmss")

    const location = [event.venueName, event.address, event.city, event.country].filter(Boolean).join(", ")

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eventa//Event Calendar//EN
BEGIN:VEVENT
UID:${event.id}@eventa.app
DTSTAMP:${DateTime.now().toFormat("yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, "\\n")}
LOCATION:${location}
URL:${process.env.NEXT_PUBLIC_APP_URL}/events/${event.id}
END:VEVENT
END:VCALENDAR`

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar",
        "Content-Disposition": `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, "-")}.ics"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error generating calendar file:", error)
    return NextResponse.json({ error: "Failed to generate calendar file" }, { status: 500 })
  }
}
