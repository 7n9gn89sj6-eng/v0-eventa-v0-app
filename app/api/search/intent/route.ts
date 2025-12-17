import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import {
  parseDatePhrase,
  parseTime,
  detectTimeConflicts,
  isPastDateTime,
} from "../../../../lib/i18n/date-parser-inline"

const intentSchema = z.object({
  intent: z
    .enum(["search", "create", "unclear"])
    .describe("Whether the user wants to search for events or create a new event"),
  confidence: z.number().min(0).max(1).describe("Confidence score for the intent classification"),
  displayLang: z.enum(["en", "el", "it", "es", "fr"]).describe("Detected language of the user input"),
  extracted: z.object({
    title: z.string().optional().describe("Event title if creating"),
    type: z.string().optional().describe("Event type/category (e.g., jazz, yoga, workshop)"),
    city: z.string().optional().describe("City name"),
    venue: z.string().optional().describe("Venue or specific location name (e.g., 'The Dock')"),
    date: z.string().optional().describe("Date phrase (keep natural language like 'this Friday', 'next Saturday')"),
    time: z.string().optional().describe("Time phrase (keep natural language like '8pm', '9am')"),
    description: z.string().optional().describe("Event description if creating"),
  }),
  paraphrase: z.string().describe("Friendly confirmation of what was understood"),
  missingFields: z.array(z.string()).optional().describe("List of missing required fields for creation"),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let inputMode: "text" | "voice" = "text"
  let errorCode: string | null = null

  try {
    const body = await request.json()
    const { query, mode, step = 2, uiLang = "en" } = body

    if (mode) {
      inputMode = mode
    }

    console.log(`[v0] Intent request - uiLang: ${uiLang}, query: ${query}`)

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("[v0] OPENAI_API_KEY not configured")
      errorCode = "ERR_MISSING_API_KEY"
      
      console.log(
        JSON.stringify({
          phase: step.toString(),
          intent: "UNKNOWN",
          entities: {},
          input_mode: inputMode,
          ui_lang: uiLang,
          error_code: errorCode,
        }),
      )

      return NextResponse.json(
        {
          error: "AI service unavailable. Please configure OPENAI_API_KEY.",
          error_code: errorCode,
          intent: "unclear",
        },
        { status: 503 },
      )
    }

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      errorCode = "ERR_EMPTY"
      console.log(
        JSON.stringify({
          phase: step.toString(),
          intent: "UNKNOWN",
          entities: {},
          input_mode: inputMode,
          ui_lang: uiLang,
          error_code: errorCode,
        }),
      )

      return NextResponse.json(
        {
          error: "Please type or say what you want to do.",
          error_code: errorCode,
          intent: "unclear",
        },
        { status: 400 },
      )
    }

    const languageNames: Record<string, string> = {
      en: "English",
      el: "Greek",
      it: "Italian",
      es: "Spanish",
      fr: "French",
    }

    // Create OpenAI provider instance with explicit API key
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: intentSchema,
      prompt: `You are a multilingual event assistant. The user's interface language is ${languageNames[uiLang] || "English"} (${uiLang}).

IMPORTANT MULTILINGUAL RULES:
1. User input may be in English (en), Greek (el), Italian (it), Spanish (es), or French (fr)
2. Detect the language of the user input and set displayLang accordingly
3. ALL structured fields (title, type, city, venue, date, time, description) MUST be normalized to English
4. The paraphrase MUST be in ${languageNames[uiLang] || "English"} (${uiLang}) - the user's chosen interface language

INTENT CLASSIFICATION:
SEARCH intent: Default to SEARCH if the query contains:
- Location names (cities, venues, places)
- Event categories/types (food, music, art, sports, etc.)
- Date/time references (today, tomorrow, weekend, etc.)
- Explicit search keywords: "find", "show me", "what's on", "look for", "search", "near me", "happening", "events in", "what's happening"
  - Greek: "βρες", "δείξε μου", "τι γίνεται", "ψάχνω", "κοντά μου", "εκδηλώσεις"
  - Italian: "trova", "mostrami", "cosa c'è", "cerco", "vicino a me", "eventi"
  - Spanish: "encuentra", "muéstrame", "qué hay", "busco", "cerca de mí", "eventos"
  - French: "trouve", "montre-moi", "qu'est-ce qu'il y a", "cherche", "près de moi", "événements"

CREATE intent: Only if the query explicitly indicates creating/adding an event:
- Keywords: "create", "add", "host", "make", "schedule", "publish", "organize", "plan", "set up"
  - Greek: "δημιούργησε", "πρόσθεσε", "φιλοξένησε", "κάνε", "προγραμμάτισε", "δημοσίευσε", "οργάνωσε"
  - Italian: "crea", "aggiungi", "ospita", "fai", "programma", "pubblica", "organizza"
  - Spanish: "crea", "añade", "organiza", "haz", "programa", "publica", "planifica"
  - French: "crée", "ajoute", "héberge", "fais", "programme", "publie", "organise"

IMPORTANT: If the query mentions a location (city, venue) OR a category/type (food, music, art, etc.) WITHOUT explicit CREATE keywords, it's a SEARCH query. Examples:
- "Athens food" → SEARCH (location + category)
- "jazz this weekend" → SEARCH (category + date)
- "events in Melbourne" → SEARCH (location)
- "create a music festival" → CREATE (explicit create keyword)

Only return "unclear" if the query is completely ambiguous and contains no location, category, date, or action keywords.

ENTITY EXTRACTION (normalize to English):
- title: event name/title (translate to English if needed)
- type: category like jazz, yoga, workshop, concert, open mic (translate to English)
- city: city name (keep original if proper noun, e.g., "Athens", "Milano", "París")
- venue: specific venue or location name (keep original if proper noun)
- date: date phrase - extract ANY date mentioned:
  * Relative dates: "today", "tomorrow", "this weekend", "next Monday" → keep as-is in English
  * Specific dates: "March 15th", "March 15, 2025", "15/03/2025", "March 20" → normalize to English format like "March 15, 2025" or "March 15th"
  * Multilingual: "mañana" → "tomorrow", "αύριο" → "tomorrow", "domani" → "tomorrow"
  * If year is missing, assume current or next year based on context
- date_iso: For SPECIFIC calendar dates (not relative), also provide ISO format (YYYY-MM-DD):
  * "March 15th" → "2025-03-15" (assume current year if not specified, or next year if date has passed)
  * "March 15, 2025" → "2025-03-15"
  * "15/03/2025" → "2025-03-15"
  * Only provide date_iso for specific calendar dates, NOT for relative dates like "today" or "tomorrow"
- time: time phrase (normalize to English: "8pm", "20:00" → "8pm")
- description: any descriptive text (translate to English)

For CREATE intent, identify which required fields are missing: title, date, time, city/venue.

PARAPHRASE (respond in ${languageNames[uiLang] || "English"}):
Provide a friendly confirmation in ${languageNames[uiLang] || "English"} that confirms understanding:
- SEARCH (${uiLang}): Confirm what they're looking for
  - en: "Looking for events in Athens this weekend."
  - el: "Ψάχνω για εκδηλώσεις στην Αθήνα αυτό το Σαββατοκύριακο."
  - it: "Cerco eventi ad Atene questo fine settimana."
  - es: "Buscando eventos en Atenas este fin de semana."
  - fr: "Je cherche des événements à Athènes ce week-end."
  
- CREATE (${uiLang}): Confirm the event details
  - en: "Create an open mic at The Dock next Saturday 8pm?"
  - el: "Δημιουργία open mic στο The Dock το επόμενο Σάββατο στις 8μμ;"
  - it: "Creare un open mic al The Dock sabato prossimo alle 20:00?"
  - es: "¿Crear un open mic en The Dock el próximo sábado a las 8pm?"
  - fr: "Créer un open mic au The Dock samedi prochain à 20h ?"
  
- UNCLEAR (${uiLang}): Ask for clarification
  - en: "Do you want to search for an event or create one?"
  - el: "Θέλετε να αναζητήσετε μια εκδήλωση ή να δημιουργήσετε μία;"
  - it: "Vuoi cercare un evento o crearne uno?"
  - es: "¿Quieres buscar un evento o crear uno?"
  - fr: "Voulez-vous rechercher un événement ou en créer un ?"

User input: "${query}"`,
    })

    let dateISO: string | null = null
    let time24h: string | null = null
    let timeConflicts: string[] | null = null
    let pastDate = false
    let invalidDate = false

    // Parse date for both SEARCH and CREATE intents
    // First check if AI provided date_iso directly (for specific calendar dates)
    if (object.extracted.date_iso) {
      // Validate ISO date format
      if (/^\d{4}-\d{2}-\d{2}$/.test(object.extracted.date_iso)) {
        dateISO = object.extracted.date_iso
      }
    }
    
    // If no date_iso, try parsing the date string (for relative dates or as fallback)
    if (!dateISO && object.extracted.date) {
      dateISO = parseDatePhrase(object.extracted.date)
      if (!dateISO && object.intent === "create") {
        invalidDate = true
      }
    }

    // Parse time
    if (object.extracted.time) {
      time24h = parseTime(object.extracted.time)
    }

    // Detect time conflicts (only for CREATE)
    if (object.intent === "create") {
      timeConflicts = detectTimeConflicts(query)

      if (dateISO && time24h) {
        pastDate = isPastDateTime(dateISO, time24h)
      }

      // Identify missing fields
      const missingFields: string[] = []
      if (!object.extracted.title) missingFields.push("title")
      if (!dateISO) missingFields.push("date")
      if (!time24h) missingFields.push("time")
      if (!object.extracted.city && !object.extracted.venue) missingFields.push("location")

      object.missingFields = missingFields
    }

    const latency = Date.now() - startTime

    if (object.intent === "unclear") {
      errorCode = "ERR_UNCLEAR"
    }

    console.log(
      JSON.stringify({
        phase: step.toString(),
        intent: object.intent.toUpperCase(),
        display_lang: object.displayLang,
        entities: {
          title: object.extracted.title || null,
          category: object.extracted.type || null,
          city: object.extracted.city || null,
          venue: object.extracted.venue || null,
          date_iso: dateISO,
          time_24h: time24h,
          description: object.extracted.description || null,
        },
        input_mode: inputMode,
        ui_lang: uiLang,
        ...(step >= 3 && object.intent === "create"
          ? {
              create: {
                missing_fields: object.missingFields || [],
                conflicts: timeConflicts ? { time: timeConflicts } : null,
                validation: {
                  pastDate,
                  invalidDate,
                },
              },
            }
          : {}),
        ...(step >= 2 && object.intent === "search"
          ? {
              search: {
                enabled: true,
                source: "internal",
                used: true,
              },
            }
          : {}),
        error_code: errorCode,
        latency_ms: latency,
      }),
    )

    return NextResponse.json({
      ...object,
      extracted: {
        ...object.extracted,
        date_iso: dateISO,
        time_24h: time24h,
      },
      validation: step >= 3 ? { pastDate, invalidDate, timeConflicts } : undefined,
      latency_ms: latency,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error("[v0] Intent recognition error:", errorMessage)
    if (errorStack) {
      console.error("[v0] Error stack:", errorStack)
    }
    
    // Check for common error types
    if (errorMessage.includes("API key") || errorMessage.includes("OPENAI_API_KEY")) {
      errorCode = "ERR_MISSING_API_KEY"
      console.error("[v0] OpenAI API key missing or invalid")
    } else if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
      errorCode = "ERR_TIMEOUT"
    } else {
      errorCode = "ERR_INTENT_PROCESSING"
    }

    console.log(
      JSON.stringify({
        phase: "3",
        intent: "UNKNOWN",
        entities: {},
        input_mode: inputMode,
        error_code: errorCode,
        error_message: errorMessage,
      }),
    )

    return NextResponse.json(
      {
        error: errorCode === "ERR_MISSING_API_KEY" 
          ? "AI service unavailable. Please check API configuration."
          : "Failed to process query",
        error_code: errorCode,
        ...(process.env.NODE_ENV === "development" && { details: errorMessage }),
      },
      { status: 500 },
    )
  }
}
