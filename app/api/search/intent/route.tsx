// app/api/search/intent/route.tsx

import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"

// —— Minimal and stable schema ——
const intentSchema = z.object({
  intent: z.enum(["search", "create", "unclear"]),
  confidence: z.number().min(0).max(1),

  displayLang: z.enum(["en", "el", "it", "es", "fr"]),

  extracted: z.object({
    title: z.string().optional(),
    type: z.string().optional(),
    city: z.string().optional(),
    venue: z.string().optional(),
    date: z.string().optional(),      // keep natural language
    time: z.string().optional(),      // keep natural language
    description: z.string().optional(),
  }),

  paraphrase: z.string(),
})

// —— Main Handler ——
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const query = body.query
    const uiLang = body.uiLang || "en"

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        {
          intent: "unclear",
          error: "Empty query",
        },
        { status: 400 }
      )
    }

    // —— AI Processing ——
    const { object } = await generateObject({
      model: "openai/gpt-4o-mini",
      schema: intentSchema,
      prompt: `
You are an event assistant. Interpret the user's request.

User input: "${query}"

Return:
- intent: search | create | unclear
- extracted fields (title, type, city, venue, date, time, description)
- displayLang: detect language of user input (en, el, it, es, fr)
- paraphrase: respond in UI language: ${uiLang}

Rules:
- search queries: extract event category/type, city, date phrase
- creation queries: extract title, date phrase, time, city/venue
- DO NOT convert dates or times; keep natural language
- Detect language of user input from words
- If unclear → intent = "unclear"
`,
    })

    return NextResponse.json(object)
  } catch (err: any) {
    console.error("[Intent API ERROR]", err)

    // Fallback — never break the UI
    return NextResponse.json(
      {
        intent: "search",
        confidence: 0,
        extracted: {},
        displayLang: "en",
        paraphrase: "Searching…",
        error: "AI processing failed — using fallback.",
      },
      { status: 200 }
    )
  }
}
