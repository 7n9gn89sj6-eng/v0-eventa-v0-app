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
    country: z.string().optional().describe("Country name (e.g., 'Greece', 'Italy', 'USA', 'United States') - extract when mentioned to disambiguate cities"),
    venue: z.string().optional().describe("Venue or specific location name (e.g., 'The Dock')"),
    date: z.string().optional().describe("Date phrase (keep natural language like 'this Friday', 'next Saturday')"),
    date_iso: z.string().optional().describe("ISO date format (YYYY-MM-DD) for specific calendar dates only, not relative dates"),
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
    const { query, mode, step = 2, uiLang = "en", userLocation } = body

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

    // Build prompt with user location context if available
    const locationContext = userLocation?.city 
      ? `\n\nCRITICAL LOCATION PRIORITY RULES:
The user's detected location is ${userLocation.city}${userLocation.country ? `, ${userLocation.country}` : ""} (coordinates: ${userLocation.lat}, ${userLocation.lng}).

LOCATION PRIORITY (in order):
1. EXPLICIT LOCATION IN QUERY (HIGHEST PRIORITY): If the user explicitly mentions a city or location in their query, ALWAYS use that location. Examples:
   - "jazz in Sydney this weekend" → extract city: "Sydney" (ignore detected location)
   - "events in Paris" → extract city: "Paris" (ignore detected location)
   - "concerts in Melbourne" → extract city: "Melbourne" (ignore detected location)

2. "AROUND ME" / "NEAR ME" PHRASES: If the user says "around me", "near me", "nearby", or similar phrases, use the detected location:
   - "jazz around me this weekend" → extract city: "${userLocation.city}"${userLocation.country ? `, country: "${userLocation.country}"` : ""}
   - "events near me" → extract city: "${userLocation.city}"${userLocation.country ? `, country: "${userLocation.country}"` : ""}
   - "what's happening nearby" → extract city: "${userLocation.city}"${userLocation.country ? `, country: "${userLocation.country}"` : ""}

3. NO LOCATION MENTIONED: If the query has no location and no "around me" phrase, use the detected location as default:
   - "jazz this weekend" → extract city: "${userLocation.city}"${userLocation.country ? `, country: "${userLocation.country}"` : ""}
   - "find concerts" → extract city: "${userLocation.city}"${userLocation.country ? `, country: "${userLocation.country}"` : ""}
   - "what events are happening" → extract city: "${userLocation.city}"${userLocation.country ? `, country: "${userLocation.country}"` : ""}

SUMMARY: Explicit location in query > "around me" phrases > detected location default`
      : ""

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: intentSchema,
      prompt: `You are a multilingual event assistant. The user's interface language is ${languageNames[uiLang] || "English"} (${uiLang}).${locationContext}

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
- city: city name - EXTRACT according to LOCATION PRIORITY RULES above. CRITICAL: Extract city names even when they appear after words like "location", "in", "at", "near", "around". Examples:
  * "jazz this weekend location melbourne" → city: "Melbourne"
  * "events in sydney" → city: "Sydney"
  * "concerts at paris" → city: "Paris"
  * "music near london" → city: "London"
  MUST normalize to English for major cities:
  * Greek: "Αθήνα" → "Athens", "Ρώμη" → "Rome", "Παρίσι" → "Paris", "Μελίν" → "Melbourne"
  * Italian: "Roma" → "Rome", "Milano" → "Milan", "Firenze" → "Florence", "Napoli" → "Naples"
  * Spanish: "Madrid" → "Madrid", "Barcelona" → "Barcelona", "Roma" → "Rome", "París" → "Paris"
  * French: "Paris" → "Paris", "Lyon" → "Lyon", "Rome" → "Rome", "Londres" → "London"
  * Keep in English if already in English (e.g., "Athens", "Rome", "Paris", "London", "Berlin")
  * For less common cities, translate if you know the English name, otherwise keep original
  * CRITICAL LOCATION DISAMBIGUATION: When a country is mentioned (e.g., "Greece", "Italy", "Spain"), prioritize locations in that country:
    - "Ithaki, Greece" → city: "Ithaki", country: "Greece" (NOT "Ithaca" which is in New York, USA)
    - "Ithaca, Greece" → city: "Ithaki", country: "Greece" (the Greek island, not the US city)
    - "Ithaca, New York" or "Ithaca, USA" → city: "Ithaca", country: "United States" (the US city)
    - "Naples, Italy" → city: "Naples", country: "Italy" (the Italian city, not Naples, Florida, USA)
    - "Naples, Florida" or "Naples, USA" → city: "Naples", country: "United States" (the US city)
  * If country context is provided, use it to disambiguate between cities with the same name in different countries
  * Always extract country when mentioned to enable proper filtering
- country: country name - extract when mentioned to disambiguate cities with the same name:
  * Normalize to standard English names: "Greece", "Italy", "Spain", "France", "United States" (or "USA"), "United Kingdom" (or "UK")
  * Use full country name when possible (e.g., "United States" not just "US")
- venue: specific venue or location name (keep original if proper noun)
- date: date phrase - extract ANY date mentioned:
  * Relative dates: "today", "tomorrow", "this weekend", "next Monday" → keep as-is in English
  * Specific dates: "March 15th", "March 15, 2025", "15/03/2025", "March 20" → normalize to English format like "March 15, 2025" or "March 15th"
  * Month + Year: "March 2026", "March 2025" → normalize to "March 2026" or "March 2025"
  * Multilingual: "mañana" → "tomorrow", "αύριο" → "tomorrow", "domani" → "tomorrow"
  * IMPORTANT: If a year is explicitly mentioned (e.g., "2026", "2025"), ALWAYS use that exact year. Never default to current year if a year is specified.
  * If year is missing, assume current or next year based on context
- date_iso: For SPECIFIC calendar dates (not relative), also provide ISO format:
  * Single day: "March 15, 2026" → "2026-03-15"
  * Month + Year (no day): "March 2026" → "2026-03-01" (first day of month)
  * Year only: "2026" → "2026-01-01" (first day of year)
  * CRITICAL: Always use the EXACT year specified. If user says "March 2026", use 2026, NOT 2025.
  * If year is missing: "March 15th" → "2025-03-15" (assume current year if date hasn't passed, or next year if it has)
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
        
        // Validate that if a year was mentioned in the query, it matches the extracted date_iso
        const queryYear = query.match(/\b(20\d{2})\b/)
        if (queryYear) {
          const extractedYear = object.extracted.date_iso.substring(0, 4)
          if (queryYear[1] !== extractedYear) {
            console.warn(`[v0] Year mismatch: query mentions ${queryYear[1]} but extracted ${extractedYear}. Correcting to ${queryYear[1]}.`)
            // Force the correct year from the query
            dateISO = queryYear[1] + object.extracted.date_iso.substring(4)
          }
        }
      } else {
        console.warn(`[v0] Invalid date_iso format: ${object.extracted.date_iso}`)
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

    // If no city was extracted but user has a detected location, use it as default
    // This handles cases where the query doesn't mention a location (e.g., "jazz this weekend")
    // The AI should have already handled "around me" phrases, but this is a safety fallback
    const extractedWithLocation = { ...object.extracted }
    
    // Check if city is missing or empty (AI might return empty string instead of undefined)
    let hasCity = extractedWithLocation.city && extractedWithLocation.city.trim().length > 0
    
    // FALLBACK: If AI didn't extract city but query contains "location [city]" pattern, try to extract it
    if (!hasCity && object.intent === "search" && query) {
      // Pattern: "location melbourne", "location sydney", etc.
      const locationCityMatch = query.match(/\blocation\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i)
      if (locationCityMatch) {
        const extractedCity = locationCityMatch[1].trim()
        extractedWithLocation.city = extractedCity
        hasCity = true
        console.log(`[v0] FALLBACK: Extracted city "${extractedCity}" from "location [city]" pattern in query`)
      }
      
      // Also try other patterns: "in [city]", "at [city]", "near [city]"
      if (!hasCity) {
        const inCityMatch = query.match(/\b(in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i)
        if (inCityMatch) {
          const extractedCity = inCityMatch[2].trim()
          // Basic validation: check if it's a reasonable city name (not a common word)
          const commonWords = ["this", "that", "the", "a", "an", "weekend", "week", "month", "year", "today", "tomorrow"]
          if (!commonWords.includes(extractedCity.toLowerCase())) {
            extractedWithLocation.city = extractedCity
            hasCity = true
            console.log(`[v0] FALLBACK: Extracted city "${extractedCity}" from "${inCityMatch[1]} [city]" pattern`)
          }
        }
      }
    }
    
    if (!hasCity && userLocation?.city && object.intent === "search") {
      extractedWithLocation.city = userLocation.city
      // Also use country if available and not already extracted
      if (userLocation.country && !extractedWithLocation.country) {
        extractedWithLocation.country = userLocation.country
      }
      console.log(`[v0] Using detected user location as default (no explicit location in query): ${userLocation.city}${userLocation.country ? `, ${userLocation.country}` : ""}`)
    } else if (hasCity) {
      console.log(`[v0] Using explicit location from query: ${extractedWithLocation.city}${extractedWithLocation.country ? `, ${extractedWithLocation.country}` : ""}`)
    } else if (!hasCity && !userLocation?.city) {
      console.log(`[v0] No location available - neither explicit location nor detected location`)
    }

    return NextResponse.json({
      ...object,
      extracted: {
        ...extractedWithLocation,
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
