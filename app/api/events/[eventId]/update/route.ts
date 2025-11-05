import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashToken } from "@/lib/crypto"

export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params
    const body = await request.json()
    const { token, title, description, location, startDate, endDate, organizerName, organizerEmail } = body

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    // Validate token
    const tokenHash = hashToken(token)

    const tokenResult = await sql`
      SELECT * FROM "EventEditToken"
      WHERE "eventId" = ${eventId}
      AND "tokenHash" = ${tokenHash}
      AND "expires" > NOW()
      LIMIT 1
    `

    if (tokenResult.length === 0) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 })
    }

    // Update event
    await sql`
      UPDATE "Event"
      SET 
        "title" = ${title},
        "description" = ${description},
        "location" = ${location},
        "startDate" = ${new Date(startDate).toISOString()},
        "endDate" = ${new Date(endDate).toISOString()},
        "organizerName" = ${organizerName},
        "organizerEmail" = ${organizerEmail},
        "updatedAt" = NOW()
      WHERE "id" = ${eventId}
    `

    // Mark token as used
    await sql`
      UPDATE "EventEditToken"
      SET "usedAt" = NOW()
      WHERE "eventId" = ${eventId}
      AND "tokenHash" = ${tokenHash}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating event:", error)
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  }
}
