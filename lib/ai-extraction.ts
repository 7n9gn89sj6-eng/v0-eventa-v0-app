import "server-only"
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import type { EventExtractionInput, EventExtractionOutput } from "./types"
export { CATEGORY_LABELS, categoryToEnum } from "./ai-extraction-constants"

export async function extractEventFromText(input: EventExtractionInput): Promise<EventExtractionOutput> {
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Concise event title extracted from the text",
        },
        start: {
          type: "string",
          description: "Event start date and time in ISO8601 format",
        },
        end: {
          type: ["string", "null"],
          description: "Event end date and time in ISO8601 format, or null if not specified",
        },
        timezone: {
          type: ["string", "null"],
          description: "IANA timezone (e.g., 'Australia/Melbourne', 'Europe/London')",
        },
        location: {
          type: "object",
          properties: {
            name: {
              type: ["string", "null"],
              description: "Venue name (e.g., 'St Kilda Library', 'Central Park')",
            },
            address: {
              type: ["string", "null"],
              description: "Full street address if provided",
            },
            lat: {
              type: ["number", "null"],
              description: "Latitude coordinate if location can be geocoded",
            },
            lng: {
              type: ["number", "null"],
              description: "Longitude coordinate if location can be geocoded",
            },
          },
          required: ["name", "address", "lat", "lng"],
        },
        description: {
          type: "string",
          description: "Full event description including all relevant details",
        },
        price: {
          type: ["string", "null"],
          enum: ["free", "donation", "paid", null],
          description:
            "Price type: 'free' if no cost, 'donation' if donation-based, 'paid' if ticketed, null if unknown",
        },
        organizer_name: {
          type: ["string", "null"],
          description: "Name of the organizer/host if mentioned",
        },
        organizer_contact: {
          type: ["string", "null"],
          description: "Email or phone contact for the organizer if provided",
        },
        category: {
          type: "string",
          enum: [
            "auto",
            "arts_culture",
            "music_nightlife",
            "food_drink",
            "family_kids",
            "sports_outdoors",
            "community_causes",
            "learning_talks",
            "markets_fairs",
            "online_virtual",
          ],
          description: "Best-fit category for the event, or 'auto' to let AI decide",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          maxItems: 5,
          description: "Up to 5 relevant tags describing the event",
        },
        confidence: {
          type: "object",
          properties: {
            datetime: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence in extracted date/time (0-1)",
            },
            location: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence in extracted location (0-1)",
            },
            title: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence in extracted title (0-1)",
            },
            category: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence in category assignment (0-1)",
            },
          },
          required: ["datetime", "location", "title", "category"],
        },
        notes_for_user: {
          type: "array",
          items: { type: "string" },
          description: "Short clarifications if extraction was ambiguous",
        },
      },
      required: [
        "title",
        "start",
        "end",
        "timezone",
        "location",
        "description",
        "price",
        "organizer_name",
        "organizer_contact",
        "category",
        "tags",
        "confidence",
        "notes_for_user",
      ],
    },
    prompt: `You are an AI event extraction system. Parse this natural language event description into structured data.

User Input:
"${input.source_text}"

${input.image_meta ? `Image Context: ${input.image_meta}` : ""}
${input.link ? `External Link: ${input.link}` : ""}
${input.contact ? `Contact Info: ${input.contact}` : ""}

EXTRACTION GUIDELINES:

1. **Date/Time Parsing**:
   - Handle relative dates: "next Friday", "this Saturday", "tomorrow"
   - Handle ranges: "2-5pm", "10am to 3pm"
   - Infer year if only month/day given (assume current/next year)
   - Default timezone to user's likely timezone based on location mentioned
   - If only date given, default to all-day event (start: 9am, end: 5pm)

2. **Location Parsing**:
   - Extract venue name if mentioned
   - Extract address components (street, city, suburb)
   - If only suburb/city mentioned, use that as location name
   - Geocode to lat/lng if you can confidently identify the location
   - For well-known venues, provide coordinates

3. **Title Generation**:
   - Create a concise, descriptive title (max 80 chars)
   - Should capture the essence of the event
   - Example: "Poetry Open Mic at St Kilda Library"

4. **Description**:
   - Expand on the title with all relevant details
   - Include any context from the original text
   - Preserve important information about accessibility, registration, etc.

5. **Price Detection**:
   - "free", "no cost", "no entry fee" → "free"
   - "gold coin", "donation", "pay what you can" → "donation"
   - Any specific price amount or "tickets required" → "paid"
   - If unclear → null

6. **Category Assignment**:
   - arts_culture: galleries, exhibitions, theater, cultural events
   - music_nightlife: concerts, gigs, DJ sets, nightlife events
   - food_drink: dining, food festivals, wine tastings, cooking events
   - family_kids: child-friendly activities, family events
   - sports_outdoors: sports, fitness, outdoor activities
   - community_causes: charity, volunteer, community gatherings
   - learning_talks: workshops, lectures, seminars, classes
   - markets_fairs: markets, fairs, bazaars
   - online_virtual: webinars, online events

7. **Tags**:
   - Generate up to 5 relevant tags
   - Use lowercase, hyphenated format: "open-mic", "family-friendly", "indoor"
   - Make them specific and useful for search/discovery

8. **Confidence Scoring**:
   - 1.0 = Explicitly stated and unambiguous
   - 0.7-0.9 = Clearly implied or reasonably inferred
   - 0.4-0.6 = Educated guess based on context
   - 0.0-0.3 = Very uncertain or missing

9. **Notes for User**:
   - Add brief notes if anything is ambiguous
   - Example: "I assumed this is in 2025 since no year was given"
   - Example: "I couldn't find a specific venue address"
   - Keep notes helpful and concise

CURRENT DATETIME FOR CONTEXT: ${new Date().toISOString()}

Be thorough but reasonable. Extract as much structured data as possible while being honest about confidence levels.`,
  })

  return object as EventExtractionOutput
}

export async function suggestFollowUpQuestion(
  extraction: EventExtractionOutput,
  missingField: "datetime" | "location",
): Promise<string> {
  const { text } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "A concise, friendly follow-up question to ask the user",
        },
      },
      required: ["question"],
    },
    prompt: `The user created an event but we need to clarify the ${missingField}.

Extracted so far:
Title: ${extraction.title}
${missingField === "datetime" ? `Location: ${extraction.location.name || "Unknown"}` : `Date: ${extraction.start}`}

Generate ONE concise, friendly follow-up question to get the missing ${missingField}. Keep it conversational and brief.

${missingField === "datetime" ? 'Example: "What day and time is this event?"' : 'Example: "Where is this event taking place?"'}`,
  })

  return (text as any).question
}

export function needsFollowUp(extraction: EventExtractionOutput): {
  needed: boolean
  field?: "datetime" | "location"
  question?: string
} {
  // Check if datetime confidence is too low
  if (extraction.confidence.datetime < 0.6) {
    return {
      needed: true,
      field: "datetime",
    }
  }

  // Check if location confidence is too low
  if (extraction.confidence.location < 0.6) {
    return {
      needed: true,
      field: "location",
    }
  }

  return { needed: false }
}
