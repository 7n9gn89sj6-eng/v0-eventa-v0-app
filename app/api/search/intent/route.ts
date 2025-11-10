export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
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

    const { object } = await generateObject({
      model: "openai/gpt-4o-mini",
      schema: intentSchema,
      prompt: `You are a multilingual event assistant. The user's interface language is ${languageNames[uiLang] || "English"} (${uiLang}).

IMPORTANT MULTILINGUAL RULES:
1. User input may be in English (en), Greek (el), Italian (it), Spanish (es), or French (fr)
2. Detect the language of the user input and set displayLang accordingly
3. ALL structured fields (title, type, city, venue, date, time, description) MUST be normalized to English
4. The paraphrase MUST be in ${languageNames[uiLang] || "English"} (${uiLang}) - the user's chosen interface language

INTENT CLASSIFICATION:
SEARCH intent keywords (any language): "find", "show me", "what's on", "look for", "search", "near me", "happening", "events in", "what's happening"
  - Greek: "βρες", "δείξε μου", "τι γίνεται", "ψάχνω", "κοντά μου", "εκδηλώσεις"
  - Italian: "trova", "mostrami", "cosa c'è", "cerco", "vicino a me", "eventi"
  - Spanish: "encuentra", "muéstrame", "qué hay", "busco", "cerca de mí", "eventos"
  - French: "trouve", "montre-moi", "qu'est-ce qu'il y a", "cherche", "près de moi", "événements"

CREATE intent keywords (any language): "create", "add", "host", "make", "schedule", "publish", "organize", "plan", "set up"
  - Greek: "δημιούργησε", "πρόσθεσε", "φιλοξένησε", "κάνε", "προγραμμάτισε", "δημοσίευσε", "οργάνωσε"
  - Italian: "crea", "aggiungi", "ospita", "fai", "programma", "pubblica", "organizza"
  - Spanish: "crea", "añade", "organiza", "haz", "programa", "publica", "planifica"
  - French: "crée", "ajoute", "héberge", "fais", "programme", "publie", "organise"

If the intent is unclear or ambiguous, return "unclear".

ENTITY EXTRACTION (normalize to English):
- title: event name/title (translate to English if needed)
- type: category like jazz, yoga, workshop, concert, open mic (translate to English)
- city: city name (keep original if proper noun, e.g., "Athens", "Milano", "París")
- venue: specific venue or location name (keep original if proper noun)
- date: date phrase (translate to English: "mañana" → "tomorrow", "αύριο" → "tomorrow", "domani" → "tomorrow")
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

    if (step >= 3 && object.intent === "create") {
      // Parse date phrase
      if (object.extracted.date) {
        dateISO = parseDatePhrase(object.extracted.date)
        if (!dateISO) {
          invalidDate = true
        }
      }

      // Parse time
      if (object.extracted.time) {
        time24h = parseTime(object.extracted.time)
      }

      // Detect time conflicts
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
    console.error("[v0] Intent recognition error:", error)
    errorCode = "ERR_INTENT_PROCESSING"

    console.log(
      JSON.stringify({
        phase: "3",
        intent: "UNKNOWN",
        entities: {},
        input_mode: inputMode,
        error_code: errorCode,
      }),
    )

    return NextResponse.json(
      {
        error: "Failed to process query",
        error_code: errorCode,
      },
      { status: 500 },
    )
  }
}
