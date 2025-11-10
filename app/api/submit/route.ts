import type { NextRequest } from "next/server"
import type { NextResponse } from "next/server"
import { jsonOk, jsonError, logInfo, logError } from "@/lib/logger"
import { FormSchema } from "@/lib/schemas/form"
import { assertEnv } from "@/lib/env"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

function withReqId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId)
  return res
}

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10)

  const envCheck = assertEnv(["DATABASE_URL", "RESEND_API_KEY"])
  if (!envCheck.ok) {
    logError("missing env", { requestId, missingKeys: envCheck.missing })
    return withReqId(
      jsonError("Server error", 500, {
        label: "MISSING_ENV",
        requestId,
        missingKeys: envCheck.missing,
      }),
      requestId,
    )
  }

  try {
    const contentType = req.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      return withReqId(jsonError("Content-Type must be application/json", 415), requestId)
    }

    // Parse JSON body
    const body = await req.json()

    // Validate with Zod
    const parsed = FormSchema.safeParse(body)

    if (!parsed.success) {
      const label = "VALIDATION_ERROR"
      logError("form submit failed", {
        requestId,
        label,
        err: "Validation failed",
        stack: undefined,
      })
      return withReqId(
        jsonError("Validation error", 400, {
          requestId,
          label,
          issues: parsed.error.issues,
        }),
        requestId,
      )
    }

    const { title, description, email } = parsed.data

    // Uncomment and modify when you need to call external APIs:
    // try {
    //   const externalData = await fetchWithTimeout("https://api.example.com/data", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ title, description }),
    //     timeoutMs: 5000, // Optional: override default 8000ms
    //   })
    //   const result = await externalData.json()
    // } catch (err: any) {
    //   // fetchWithTimeout will throw labeled timeout errors
    //   throw err
    // }

    const result = {
      saved: true,
      id: randomUUID(),
    }

    // Log success with detailed metrics
    logInfo("form submit ok", {
      requestId,
      inputSummary: {
        title,
        hasEmail: !!email,
        descLen: description.length,
      },
    })

    return withReqId(jsonOk(result, 200), requestId)
  } catch (err: any) {
    let label = "SERVER_ERROR"

    if (err?.message?.includes("__label:UPSTREAM_TIMEOUT")) {
      label = "UPSTREAM_TIMEOUT"
    } else if (err?.name === "FetchError" || err?.message?.includes("fetch")) {
      label = "UPSTREAM_FETCH"
    } else if (err?.name === "TypeError" && err?.cause?.code === "ENOTFOUND") {
      // Network/DNS errors from fetch
      label = "UPSTREAM_FETCH"
    }

    logError("form submit failed", {
      requestId,
      label,
      err: err?.message,
      stack: err?.stack,
    })

    const isDev = process.env.NODE_ENV !== "production"
    const meta: Record<string, unknown> = {
      requestId,
      label,
    }

    if (isDev) {
      meta.debug = {
        message: err?.message,
        stack: err?.stack,
      }
    }

    // Return error response with correlation data
    return withReqId(jsonError("Server error", 500, meta), requestId)
  }
}
