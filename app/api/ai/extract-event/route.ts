import { NextResponse } from "next/server"
import { extractEventFromText } from "@/lib/ai-extraction"
import type { EventExtractionInput } from "@/lib/types"

export const runtime = "nodejs"

type ExtractFailureCategory = "provider_config" | "schema_validation" | "unknown"

const DEV_MESSAGE_MAX = 800

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || "Error"
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** Heuristic classification for logs (not authoritative). */
function classifyExtractFailure(message: string): ExtractFailureCategory {
  const m = message.toLowerCase()

  const providerHints =
    /\b(401|403|429)\b/.test(m) ||
    m.includes("api key") ||
    m.includes("incorrect api") ||
    m.includes("invalid_api") ||
    m.includes("invalid api") ||
    m.includes("unauthorized") ||
    m.includes("authentication") ||
    m.includes("billing") ||
    m.includes("quota") ||
    m.includes("insufficient_quota") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("econnrefused") ||
    m.includes("fetch failed") ||
    m.includes("enotfound") ||
    m.includes("etimedout") ||
    m.includes("network error") ||
    m.includes("connection") ||
    (m.includes("model") && (m.includes("not found") || m.includes("does not exist"))) ||
    m.includes("invalid_request_error") ||
    m.includes("context_length_exceeded")

  if (providerHints) return "provider_config"

  const schemaHints =
    m.includes("schema") ||
    m.includes("validation") ||
    m.includes("zod") ||
    m.includes("no object generated") ||
    m.includes("could not parse") ||
    m.includes("failed to parse") ||
    m.includes("does not match") ||
    m.includes("type validation") ||
    m.includes("invalid value") ||
    m.includes("invalid_enum") ||
    m.includes("json") && (m.includes("invalid") || m.includes("parse"))

  if (schemaHints) return "schema_validation"

  return "unknown"
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EventExtractionInput

    if (!body.source_text || body.source_text.trim().length === 0) {
      return NextResponse.json({ error: "source_text is required" }, { status: 400 })
    }

    const extraction = await extractEventFromText(body)

    return NextResponse.json(extraction)
  } catch (error) {
    const message = getErrorMessage(error)
    const category = classifyExtractFailure(message)
    const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim())

    console.error(
      "[v0] Event extraction error:",
      JSON.stringify({
        category,
        hasOpenAiKey,
        message: message.slice(0, DEV_MESSAGE_MAX),
        name: error instanceof Error ? error.name : undefined,
      }),
    )
    if (error instanceof Error && error.stack) {
      console.error("[v0] Event extraction stack (first 1200 chars):", error.stack.slice(0, 1200))
    }

    const isDev = process.env.NODE_ENV === "development"
    const payload: Record<string, unknown> = {
      error: "Failed to extract event data",
    }
    if (isDev) {
      payload.debug = {
        category,
        /** Presence only — never log or return the key itself. */
        openAiKeyConfigured: hasOpenAiKey,
        message: message.slice(0, DEV_MESSAGE_MAX),
      }
    }

    return NextResponse.json(payload, { status: 500 })
  }
}
