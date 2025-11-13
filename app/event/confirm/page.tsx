import { redirect } from "next/navigation"
import { neon } from "@neondatabase/serverless"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SearchParams = Promise<{ token?: string; diagnosticMode?: string; dryRunMode?: string }>

async function realConfirmFunction(token: string | undefined) {
  console.log("[v0] Step 1: Checking token presence")
  if (!token) {
    console.log("[v0] Step 1: FAILED - No token provided")
    return {
      type: "error",
      title: "Invalid link",
      description: "Your verification link is missing a token. Check your email for the confirmation link.",
    }
  }
  console.log("[v0] Step 1: OK - Token present:", token.slice(0, 10) + "...")

  console.log("[v0] Step 2: Checking database URL")
  const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

  if (!NEON_DATABASE_URL) {
    console.log("[v0] Step 2: FAILED - No database URL")
    throw new Error("Database URL not configured")
  }
  console.log("[v0] Step 2: OK - Database URL present")

  console.log("[v0] Step 3: Creating SQL client")
  const sql = neon(NEON_DATABASE_URL)
  console.log("[v0] Step 3: OK - SQL client created")

  console.log("[v0] Step 4: Querying all tokens from database")
  let allTokens
  try {
    allTokens = await sql`
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
    console.log("[v0] Step 4: OK - Found", allTokens.length, "tokens in database")
  } catch (dbError) {
    console.error("[v0] Step 4: FAILED - Database query error:", dbError)
    throw new Error(`Database query failed: ${String(dbError).slice(0, 300)}`)
  }

  console.log("[v0] Step 5: Comparing token with bcrypt")
  let matchedToken: any = null
  let comparisonCount = 0
  try {
    for (const tokenRecord of allTokens) {
      comparisonCount++
      console.log(`[v0] Step 5.${comparisonCount}: Comparing with token record ${tokenRecord.id}`)

      let isMatch = false
      try {
        isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
      } catch (bcryptError) {
        console.log(`[v0] Step 5.${comparisonCount}: Bcrypt failed, trying plain comparison`)
        isMatch = token === tokenRecord.tokenHash
      }

      if (isMatch) {
        matchedToken = tokenRecord
        console.log("[v0] Step 5: OK - Token matched on comparison", comparisonCount)
        break
      }
    }
  } catch (bcryptError) {
    console.error("[v0] Step 5: FAILED - Bcrypt comparison error:", bcryptError)
    throw new Error(`Token comparison failed: ${String(bcryptError).slice(0, 300)}`)
  }

  if (!matchedToken) {
    console.log("[v0] Step 5: FAILED - No matching token found after", comparisonCount, "comparisons")
    return {
      type: "error",
      title: "Invalid Confirmation Link",
      description:
        "This confirmation link is invalid. Please check the URL or look for the correct link in your email.",
    }
  }

  console.log("[v0] Step 6: Checking token expiry")
  const now = new Date()
  if (new Date(matchedToken.expires) <= now) {
    console.log("[v0] Step 6: FAILED - Token expired at", matchedToken.expires)
    return {
      type: "error",
      title: "Confirmation Link Expired",
      description: "This confirmation link has expired. Confirmation links are valid for 30 days after creation.",
    }
  }
  console.log("[v0] Step 6: OK - Token not expired")

  console.log("[v0] Step 7: Checking event ID")
  const eventId = matchedToken.event_id

  if (!eventId) {
    console.log("[v0] Step 7: FAILED - No event ID found")
    return { type: "redirect", url: "/" }
  }
  console.log("[v0] Step 7: OK - Event ID:", eventId)

  console.log("[v0] Step 8: Checking event status")
  if (matchedToken.event_status === "PUBLISHED") {
    console.log("[v0] Step 8: Event already published, redirecting to edit")
    return { type: "redirect", url: `/edit/${eventId}?token=${token}` }
  }
  console.log("[v0] Step 8: OK - Event not yet published")

  console.log("[v0] Step 9: Updating event status to PUBLISHED")
  try {
    await sql`
      UPDATE "Event"
      SET status = 'PUBLISHED'
      WHERE id = ${eventId}
    `
    console.log("[v0] Step 9: OK - Event status updated to PUBLISHED")
  } catch (updateError) {
    console.error("[v0] Step 9: FAILED - Update error:", updateError)
    throw new Error(`Failed to update event: ${String(updateError).slice(0, 300)}`)
  }

  console.log("[v0] Step 10: Redirecting to edit page with confirmation flag")
  return { type: "redirect", url: `/edit/${eventId}?token=${token}&confirmed=true` }
}

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

  try {
    const result = await realConfirmFunction(token)

    console.log("[v0] Confirmation result:", result.type)

    if (dryRunMode) {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Dry Run Mode - Simulation Only</CardTitle>
                <CardDescription className="mt-4">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify({ ok: true, dryRun: true, simulatedOutput: result }, null, 2)}
                  </pre>
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )
    }

    if (result.type === "redirect") {
      redirect(result.url)
    }

    if (result.type === "error") {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <CardTitle>{result.title}</CardTitle>
                </div>
                <CardDescription>{result.description}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )
    }

    // Fallback redirect
    redirect("/")
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
