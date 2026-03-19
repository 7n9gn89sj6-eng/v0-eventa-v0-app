import { type NextRequest, NextResponse } from "next/server"
import { parseSearchIntent } from "@/app/lib/search/parseSearchIntent"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const query = String(body?.query || "").trim()
    const uiLang = String(body?.uiLang || "en")

    if (!query) {
      return NextResponse.json(
        { error: "Please type or say what you want to do.", intent: "unclear" },
        { status: 400 },
      )
    }

    const parsed = parseSearchIntent(query)
    const topInterest = parsed.interest?.[0]

    return NextResponse.json({
      // Keep compatibility fields for current UI callers.
      intent: "search",
      confidence: parsed.confidence ?? 0.5,
      displayLang: uiLang,
      extracted: {
        type: topInterest,
        category: topInterest,
        city: parsed.place?.city,
        country: parsed.place?.country,
        date: parsed.time?.label,
        date_iso: parsed.time?.date_from,
      },
      paraphrase: query,
      // New structured deterministic intent payload.
      parsedIntent: parsed,
    })
  } catch {
    return NextResponse.json(
      {
        error: "Something went wrong. Please try again.",
        intent: "unclear",
      },
      { status: 500 },
    )
  }
}

