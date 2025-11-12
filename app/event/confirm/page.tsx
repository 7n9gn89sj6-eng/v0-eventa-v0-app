import { redirect } from "next/navigation"
import { neon } from "@neondatabase/serverless"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SearchParams = Promise<{ token?: string; diagnosticMode?: string; dryRunMode?: string }>

async function realConfirmFunction(token: string | undefined) {
  if (!token) {
    return {
      type: "error",
      title: "Invalid link",
      description: "Your verification link is missing a token. Check your email for the confirmation link.",
    }
  }

  const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

  if (!NEON_DATABASE_URL) {
    throw new Error("Database URL not configured")
  }

  const sql = neon(NEON_DATABASE_URL)

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

  let matchedToken: any = null
  for (const tokenRecord of allTokens) {
    const isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
    if (isMatch) {
      matchedToken = tokenRecord
      break
    }
  }

  if (!matchedToken) {
    return {
      type: "error",
      title: "Invalid Confirmation Link",
      description:
        "This confirmation link is invalid. Please check the URL or look for the correct link in your email.",
    }
  }

  const now = new Date()
  if (new Date(matchedToken.expires) <= now) {
    return {
      type: "error",
      title: "Confirmation Link Expired",
      description: "This confirmation link has expired. Confirmation links are valid for 30 days after creation.",
    }
  }

  const eventId = matchedToken.event_id

  if (!eventId) {
    return { type: "redirect", url: "/" }
  }

  if (matchedToken.event_status === "PUBLISHED") {
    return { type: "redirect", url: `/edit/${eventId}?token=${token}` }
  }

  await sql`
    UPDATE "Event"
    SET status = 'PUBLISHED'
    WHERE id = ${eventId}
  `

  return { type: "redirect", url: `/edit/${eventId}?token=${token}` }
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

  console.log("[v0] DIAGNOSTIC START", { diagnosticMode, dryRunMode, hasToken: !!token })

  try {
    const result = await realConfirmFunction(token)

    console.log("[v0] DIAGNOSTIC RESULT", { result, dryRunMode })

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

    // Fallback
    redirect("/")
  } catch (err: any) {
    const msg = String(err?.message || err)
    const stack = String(err?.stack || "")
    console.error("[v0] DIAGNOSTIC ERROR", { msg, stack })

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
      <div className="max-w-md mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2">
          {looksLikePostcode
            ? "We're updating our database to support this postcode format. Please try again shortly."
            : "Please try the link again in a moment."}
        </p>
        <pre className="mt-4 text-xs whitespace-pre-wrap opacity-60">{msg.slice(0, 600)}</pre>
      </div>
    )
  }
}
