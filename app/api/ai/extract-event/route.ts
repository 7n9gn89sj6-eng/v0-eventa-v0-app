import { NextResponse } from "next/server"
import { extractEventFromText } from "@/lib/ai-extraction"
import type { EventExtractionInput } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EventExtractionInput

    if (!body.source_text || body.source_text.trim().length === 0) {
      return NextResponse.json({ error: "source_text is required" }, { status: 400 })
    }

    const extraction = await extractEventFromText(body)

    return NextResponse.json(extraction)
  } catch (error) {
    console.error("[v0] Event extraction error:", error)
    return NextResponse.json({ error: "Failed to extract event data" }, { status: 500 })
  }
}
