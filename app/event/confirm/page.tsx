import { redirect } from "next/navigation"
import { neon } from "@neondatabase/serverless"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import bcrypt from "bcryptjs"

export default async function EventConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  console.log("[v0] EventConfirmPage - Starting")

  const params = await searchParams
  const token = params.token

  console.log("[v0] Token received:", token ? "Yes" : "No")

  if (!token) {
    console.log("[v0] No token provided, showing error")
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Confirmation Link Required</CardTitle>
              </div>
              <CardDescription>
                You need a valid confirmation link to finalize this event. Check your email for the link that was sent
                when you submitted the event.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

  console.log("[v0] Database URL configured:", NEON_DATABASE_URL ? "Yes" : "No")

  if (!NEON_DATABASE_URL) {
    throw new Error("Database URL not configured")
  }

  try {
    const sql = neon(NEON_DATABASE_URL)

    console.log("[v0] Attempting to query EventEditToken table")

    // Get all tokens
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

    console.log("[v0] Query successful, found tokens:", allTokens.length)

    // Find matching token by comparing hashes
    let matchedToken: any = null
    for (const tokenRecord of allTokens) {
      const isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
      if (isMatch) {
        matchedToken = tokenRecord
        break
      }
    }

    console.log("[v0] Token match found:", matchedToken ? "Yes" : "No")

    if (!matchedToken) {
      console.log("[v0] No matching token, showing error")
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <CardTitle>Invalid Confirmation Link</CardTitle>
                </div>
                <CardDescription>
                  This confirmation link is invalid. Please check the URL or look for the correct link in your email.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )
    }

    const now = new Date()
    if (new Date(matchedToken.expires) <= now) {
      console.log("[v0] Token expired")
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <CardTitle>Confirmation Link Expired</CardTitle>
                </div>
                <CardDescription>
                  This confirmation link has expired. Confirmation links are valid for 30 days after creation.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )
    }

    const eventId = matchedToken.event_id

    console.log("[v0] Event ID:", eventId)

    if (!eventId) {
      console.log("[v0] No event ID, redirecting to home")
      redirect("/")
    }

    if (matchedToken.event_status === "PUBLISHED") {
      console.log("[v0] Event already published, redirecting to edit")
      redirect(`/edit/${eventId}?token=${token}`)
    }

    console.log("[v0] Updating event status to PUBLISHED")

    // Update event status to PUBLISHED
    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED'
      WHERE id = ${eventId}
    `

    console.log("[v0] Redirecting to edit page")
    redirect(`/edit/${eventId}?token=${token}`)
  } catch (error) {
    console.error("[v0] Error in EventConfirmPage:", error)
    throw error
  }
}
