import { redirect } from "next/navigation"
import { neon } from "@neondatabase/serverless"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SearchParams = Promise<{ token?: string; diagnosticMode?: string; dryRunMode?: string }>

export default async function EventConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const token = params.token
  const diagnosticMode = params.diagnosticMode === "true"
  const dryRunMode = params.dryRunMode === "true"

  console.log("[v0] Confirm page loaded", { diagnosticMode, dryRunMode, hasToken: !!token })

  if (!token) {
    console.log("[v0] No token provided")
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Invalid link</CardTitle>
              </div>
              <CardDescription>
                Your verification link is missing a token. Check your email for the confirmation link.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
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
        isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
      } catch {
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

    // Check expiry
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

    if (!eventId) {
      console.log("[v0] No event ID found, redirecting home")
      redirect("/")
    }

    if (matchedToken.event_status === "PUBLISHED") {
      console.log("[v0] Event already published, redirecting to edit")
      redirect(`/edit/${eventId}?token=${token}`)
    }

    console.log("[v0] Publishing event")
    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED'
      WHERE id = ${eventId}
    `
    console.log("[v0] Event published successfully")

    redirect(`/edit/${eventId}?token=${token}&confirmed=true`)
  } catch (err: any) {
    const msg = String(err?.message || err)
    const stack = String(err?.stack || "")
    console.error("[v0] Confirmation error:", msg)

    if (diagnosticMode) {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Diagnostic Mode - Error Captured</CardTitle>
                <CardDescription className="mt-4">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(
                      {
                        ok: false,
                        diagnostic: true,
                        errorMessage: msg,
                        errorStack: stack.slice(0, 1000),
                        input: { hasToken: !!token, diagnosticMode, dryRunMode },
                      },
                      null,
                      2,
                    )}
                  </pre>
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )
    }

    const looksLikePostcode =
      msg.includes("postcode") || stack.includes("postcode") || (msg.includes("column") && msg.includes("type"))

    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                {looksLikePostcode
                  ? "We're updating our database to support this postcode format. Please try again shortly."
                  : "Please try the link again in a moment."}
              </CardDescription>
              {process.env.NODE_ENV === "development" && (
                <pre className="mt-4 text-xs whitespace-pre-wrap opacity-60 bg-muted p-2 rounded">
                  {msg.slice(0, 600)}
                </pre>
              )}
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }
}
