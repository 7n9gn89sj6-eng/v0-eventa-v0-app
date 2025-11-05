import { generateObject, generateText } from "ai"

export interface EventAnalysis {
  qualityScore: number // 0-100
  spamProbability: number // 0-1
  contentFlags: string[]
  suggestedCategories: string[]
  sentiment: "positive" | "neutral" | "negative"
  recommendations: string[]
  shouldAutoApprove: boolean
}

export async function analyzeEventContent(event: {
  title: string
  description: string
  city: string
  country: string
}): Promise<EventAnalysis> {
  const { object } = await generateObject({
    model: "openai/gpt-4o-mini",
    schema: {
      type: "object",
      properties: {
        qualityScore: { type: "number", description: "Quality score from 0-100" },
        spamProbability: { type: "number", description: "Spam probability from 0-1" },
        contentFlags: {
          type: "array",
          items: { type: "string" },
          description: "List of content issues (spam, inappropriate, misleading, etc.)",
        },
        suggestedCategories: {
          type: "array",
          items: { type: "string" },
          description: "Suggested event categories",
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative"],
          description: "Overall sentiment of the event",
        },
        recommendations: {
          type: "array",
          items: { type: "string" },
          description: "Recommendations for improving the event listing",
        },
        shouldAutoApprove: {
          type: "boolean",
          description: "Whether this event should be auto-approved based on quality",
        },
      },
      required: [
        "qualityScore",
        "spamProbability",
        "contentFlags",
        "suggestedCategories",
        "sentiment",
        "recommendations",
        "shouldAutoApprove",
      ],
    },
    prompt: `Analyze this event submission for quality, spam, and appropriateness:

Title: ${event.title}
Description: ${event.description}
Location: ${event.city}, ${event.country}

Provide a comprehensive analysis including:
1. Quality score (0-100) based on completeness, clarity, and professionalism
2. Spam probability (0-1) - check for promotional spam, scams, or fake events
3. Content flags - identify any issues (spam, inappropriate language, misleading info, etc.)
4. Suggested categories - what type of event is this? (Music, Arts, Sports, Tech, Business, etc.)
5. Sentiment - is this a positive, neutral, or negative event?
6. Recommendations - how can this event listing be improved?
7. Should auto-approve - if quality score > 70 and spam probability < 0.3, recommend auto-approval`,
  })

  return object as EventAnalysis
}

export async function generateModerationSummary(events: Array<{ title: string; status: string }>): Promise<string> {
  const { text } = await generateText({
    model: "openai/gpt-4o-mini",
    prompt: `You are an AI moderation assistant. Analyze these events and provide a brief summary of moderation priorities:

Events:
${events.map((e, i) => `${i + 1}. ${e.title} (${e.status})`).join("\n")}

Provide a 2-3 sentence summary highlighting:
- How many events need review
- Any patterns or concerns
- Priority actions for the admin`,
  })

  return text
}

export async function detectDuplicateEvents(
  newEvent: { title: string; description: string },
  existingEvents: Array<{ id: string; title: string; description: string }>,
): Promise<Array<{ eventId: string; similarity: number; reason: string }>> {
  const { object } = await generateObject({
    model: "openai/gpt-4o-mini",
    schema: {
      type: "object",
      properties: {
        duplicates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              eventId: { type: "string" },
              similarity: { type: "number", description: "Similarity score 0-1" },
              reason: { type: "string", description: "Why this might be a duplicate" },
            },
            required: ["eventId", "similarity", "reason"],
          },
        },
      },
      required: ["duplicates"],
    },
    prompt: `Check if this new event is a duplicate of any existing events:

New Event:
Title: ${newEvent.title}
Description: ${newEvent.description}

Existing Events:
${existingEvents.map((e, i) => `${i + 1}. [ID: ${e.id}] ${e.title}\n   ${e.description}`).join("\n\n")}

Return any events that might be duplicates with similarity scores (0-1) and reasons.`,
  })

  return (object as any).duplicates
}
