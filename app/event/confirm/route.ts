import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

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

    const tokens = await sql`
      SELECT "EventEditToken".id, "EventEditToken"."eventId", "EventEditToken"."tokenHash",
             "Event".status, "Event".title
      FROM "EventEditToken"
      JOIN "Event" ON "EventEditToken"."eventId" = "Event".id
      WHERE "EventEditToken".expires > NOW()
    `

    if (tokens.length === 0) {
      console.log("[v0] No valid tokens found")
      return NextResponse.redirect(new URL("/error?code=invalid-token", request.url))
    }

    let matchedToken = null
    for (const record of tokens) {
      try {
        const isMatch = await bcrypt.compare(token, record.tokenHash)
        if (isMatch) {
          matchedToken = record
          break
        }
      } catch {
        if (token === record.tokenHash) {
          matchedToken = record
          break
        }
      }
    }

    if (!matchedToken) {
      console.log("[v0] No token match")
      return NextResponse.redirect(new URL("/error?code=invalid-token", request.url))
    }

    const eventId = matchedToken.eventId

    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED', "updatedAt" = NOW()
      WHERE id = ${eventId}
    `

    console.log("[v0] Event confirmed:", eventId)

    return NextResponse.redirect(new URL(`/edit/${eventId}?confirmed=true`, request.url))
  } catch (error) {
    console.error("[v0] Confirmation error:", error)
    return NextResponse.redirect(new URL("/error?code=server-error", request.url))
  }
}
