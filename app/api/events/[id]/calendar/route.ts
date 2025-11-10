import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

function formatICSDate(date: Date, timezone: string): string {
  // Format: YYYYMMDDTHHMMSS
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

function escapeICSText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

function foldICSLine(line: string): string {
  // ICS lines should be max 75 characters, fold longer lines
  if (line.length <= 75) return line

  const lines = []
  let currentLine = line.substring(0, 75)
  let remaining = line.substring(75)

  lines.push(currentLine)

  while (remaining.length > 0) {
    currentLine = " " + remaining.substring(0, 74) // Space prefix for continuation
    remaining = remaining.substring(74)
    lines.push(currentLine)
  }

  return lines.join("\r\n")
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const event = await db.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Only allow calendar export for approved events
    if (event.moderationStatus !== "APPROVED" && event.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Event not available" }, { status: 404 })
    }

    const timezone = event.timezone || "UTC"
    const startDate = new Date(event.startAt)
    const endDate = new Date(event.endAt)

    // Build location string
    const locationParts = [event.venueName, event.address || event.locationAddress, event.city, event.country].filter(
      Boolean,
    )
    const location = escapeICSText(locationParts.join(", "))

    // Build organizer
    const organizerName = event.createdBy.name || "Event Organizer"
    const organizerEmail = event.createdBy.email

    // Build description with URL
    let description = escapeICSText(event.description)
    if (event.externalUrl) {
      description += `\\n\\nMore info: ${event.externalUrl}`
    }
    description += `\\n\\nView on Eventa: ${process.env.NEXT_PUBLIC_APP_URL || "https://eventa.app"}/events/${event.id}`

    // Generate unique UID
    const uid = `${event.id}@${process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, "") || "eventa.app"}`

    // Format dates
    const now = new Date()
    const dtstamp = formatICSDate(now, "UTC") + "Z"
    const dtstart = formatICSDate(startDate, timezone)
    const dtend = formatICSDate(endDate, timezone)

    // Build ICS content with proper line folding
    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Eventa//Event Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${timezone}:${dtstart}`,
      `DTEND;TZID=${timezone}:${dtend}`,
      foldICSLine(`SUMMARY:${escapeICSText(event.title)}`),
      foldICSLine(`DESCRIPTION:${description}`),
      foldICSLine(`LOCATION:${location}`),
      foldICSLine(`ORGANIZER;CN=${escapeICSText(organizerName)}:mailto:${organizerEmail}`),
      foldICSLine(`URL:${process.env.NEXT_PUBLIC_APP_URL || "https://eventa.app"}/events/${event.id}`),
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "END:VEVENT",
      "END:VCALENDAR",
    ]

    const icsContent = icsLines.join("\r\n")

    // Generate safe filename
    const safeTitle = event.title.replace(/[^a-z0-9]/gi, "-").substring(0, 50)
    const filename = `${safeTitle}.ics`

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("[v0] Error generating calendar file:", error)
    return NextResponse.json({ error: "Failed to generate calendar file" }, { status: 500 })
  }
}
