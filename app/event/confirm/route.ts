import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  // Missing token
  if (!token) {
    console.log("[v0] Confirmation attempted without token")
    return NextResponse.redirect(new URL("/error?code=invalid-token", request.url))
  }

  try {
    const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL
    if (!NEON_DATABASE_URL) {
      console.error("[v0] NEON_DATABASE_URL is missing")
      return NextResponse.redirect(new URL("/error?code=server-error", request.url))
    }

    const sql = neon(NEON_DATABASE_URL)

    // Find all tokens for potential match
    const tokens = await sql`
      SELECT "EventEditToken".id, "EventEditToken"."eventId", "EventEditToken"."tokenHash", 
             "Event".status, "Event".title
      FROM "EventEditToken"
      JOIN "Event" ON "EventEditToken"."eventId" = "Event".id
      WHERE "EventEditToken".expires > NOW()
    `

    if (tokens.length === 0) {
      console.log("[v0] No valid tokens found in database")
      return NextResponse.redirect(new URL("/error?code=invalid-token", request.url))
    }

    // Try to match token using bcrypt (new tokens) or plain text (old tokens)
    let matchedToken = null
    for (const tokenRecord of tokens) {
      try {
        const isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
        if (isMatch) {
          matchedToken = tokenRecord
          break
        }
      } catch {
        // Fallback: try plain text comparison for old tokens
        if (token === tokenRecord.tokenHash) {
          matchedToken = tokenRecord
          break
        }
      }
    }

    if (!matchedToken) {
      console.log("[v0] Token does not match any record")
      return NextResponse.redirect(new URL("/error?code=invalid-token", request.url))
    }

    const eventId = matchedToken.eventId

    // Update event to PUBLISHED status
    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED', "updatedAt" = NOW()
      WHERE id = ${eventId}
    `

    console.log("[v0] Event confirmed and published:", eventId)

    // Redirect to edit page with success parameter
    return NextResponse.redirect(new URL(`/events/${eventId}/edit?confirmed=true`, request.url))

  } catch (error) {
    console.error("[v0] Error during confirmation:", error)
    return NextResponse.redirect(new URL("/error?code=server-error", request.url))
  }
}
