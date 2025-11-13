import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get("token")

  console.log("[v0] Confirm API called", { hasToken: !!token })

  if (!token) {
    console.log("[v0] No token provided")
    return NextResponse.redirect(new URL("/?error=no-token", request.url))
  }

  try {
    const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

    if (!NEON_DATABASE_URL) {
      throw new Error("Database URL not configured")
    }

    const sql = neon(NEON_DATABASE_URL)

    // Query tokens
    const allTokens = await sql`
      SELECT 
        et.id,
        et."tokenHash",
        et."eventId",
        et.expires,
        e.id as "event_id",
        e.status as "event_status"
      FROM "EventEditToken" et
      LEFT JOIN "Event" e ON e.id = et."eventId"
    `

    console.log("[v0] Found", allTokens.length, "tokens in database")

    // Find matching token
    let matchedToken: any = null
    for (const tokenRecord of allTokens) {
      let isMatch = false
      try {
        // Try bcrypt comparison first (for new tokens)
        isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
      } catch {
        // Fallback to plain text comparison (for old tokens)
        isMatch = token === tokenRecord.tokenHash
      }

      if (isMatch) {
        matchedToken = tokenRecord
        console.log("[v0] Token matched")
        break
      }
    }

    if (!matchedToken) {
      console.log("[v0] No matching token found")
      return NextResponse.redirect(new URL("/?error=invalid-token", request.url))
    }

    // Check expiry
    const now = new Date()
    if (new Date(matchedToken.expires) <= now) {
      console.log("[v0] Token expired")
      return NextResponse.redirect(new URL("/?error=expired-token", request.url))
    }

    const eventId = matchedToken.event_id

    if (!eventId) {
      console.log("[v0] No event ID found")
      return NextResponse.redirect(new URL("/?error=no-event", request.url))
    }

    // If already published, just redirect to edit page
    if (matchedToken.event_status === "PUBLISHED") {
      console.log("[v0] Event already published, redirecting to edit")
      return NextResponse.redirect(new URL(`/edit/${eventId}?token=${token}`, request.url))
    }

    // Publish the event
    console.log("[v0] Publishing event")
    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED'
      WHERE id = ${eventId}
    `
    console.log("[v0] Event published successfully")

    // Redirect to edit page with confirmed flag
    return NextResponse.redirect(new URL(`/edit/${eventId}?token=${token}&confirmed=true`, request.url))
  } catch (err: any) {
    const msg = String(err?.message || err)
    console.error("[v0] Confirmation error:", msg)

    return NextResponse.redirect(new URL("/?error=server-error", request.url))
  }
}
