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

export interface ModerationResult {
  status: "approved" | "flagged" | "rejected"
  reason: string
  severity_level: "low" | "medium" | "high"
  policy_category: string
  confidence: number // 0-1
  details: string[]
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

export async function moderateEventContent(event: {
  title: string
  description: string
  city: string
  country: string
  externalUrl?: string
}): Promise<ModerationResult> {
  const { object } = await generateObject({
    model: "openai/gpt-4o-mini",
    schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["approved", "flagged", "rejected"],
          description: "Moderation decision",
        },
        reason: {
          type: "string",
          description: "Explanation of the moderation decision",
        },
        severity_level: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Severity of any issues found",
        },
        policy_category: {
          type: "string",
          description:
            "Category of policy violation if any (e.g., grooming, hate_event, exploitation, criminal_activity, extremism, spam, inappropriate_content, safe)",
        },
        confidence: {
          type: "number",
          description: "Confidence level in the moderation decision (0-1)",
        },
        details: {
          type: "array",
          items: { type: "string" },
          description: "Specific details about any issues found",
        },
      },
      required: ["status", "reason", "severity_level", "policy_category", "confidence", "details"],
    },
    prompt: `You are a content moderation AI protecting a community events platform. Analyze this event submission for harmful, inappropriate, or policy-violating content.

Event Details:
Title: ${event.title}
Description: ${event.description}
Location: ${event.city}, ${event.country}
${event.externalUrl ? `External URL: ${event.externalUrl}` : ""}

CRITICAL POLICY VIOLATIONS TO DETECT:
1. **Grooming or Child Exploitation** - Any content that could be used to exploit, groom, or harm minors
2. **Hate Gatherings** - Events promoting hate speech, discrimination, or violence against protected groups
3. **Exploitation of Vulnerable Persons** - Events targeting or exploiting vulnerable populations
4. **Criminal Activity** - Events promoting illegal activities, scams, fraud, or violence
5. **Extremism** - Events promoting extremist ideologies, terrorism, or radicalization
6. **Spam/Scams** - Obvious spam, phishing, or fraudulent events
7. **Inappropriate Content** - Explicit sexual content, graphic violence, or other inappropriate material

MODERATION GUIDELINES:
- **REJECTED**: Clear policy violations (grooming, hate, exploitation, criminal activity, extremism) - HIGH severity
- **FLAGGED**: Suspicious content that needs human review - MEDIUM severity
- **APPROVED**: Safe, legitimate community events - LOW severity

Provide:
1. Status: approved | flagged | rejected
2. Reason: Clear explanation of your decision
3. Severity Level: low | medium | high
4. Policy Category: The specific category (grooming, hate_event, exploitation, criminal_activity, extremism, spam, inappropriate_content, or safe)
5. Confidence: How confident you are in this decision (0-1)
6. Details: Specific issues or red flags found

Be thorough but fair. Legitimate events should be approved. When in doubt, flag for human review rather than auto-rejecting.`,
  })

  return object as ModerationResult
}
