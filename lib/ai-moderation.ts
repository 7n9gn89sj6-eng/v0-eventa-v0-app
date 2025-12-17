// lib/ai-moderation.ts
"use server";

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* -------------------------------------------------------------
   Utility: Remove ```json fences & parse JSON safely
------------------------------------------------------------- */
function extractJson(text: string) {
  if (!text) throw new Error("Empty AI response");

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[AI] Failed to parse JSON. Raw output:", text);
    throw new Error("AI returned invalid JSON");
  }
}

/* -------------------------------------------------------------
   Base moderation: simple, boolean-oriented
------------------------------------------------------------- */

export type ModerateEventInput = {
  title: string;
  description: string;
  categories?: string[];
  languages?: string[];
  city?: string | null;
  country?: string | null;
};

export type ModerateEventResult = {
  approved: boolean;
  needsReview: boolean;
  reason: string;
};

export async function moderateEvent(input: ModerateEventInput): Promise<ModerateEventResult> {
  console.log("[AI] moderateEvent called with:", input);

  const prompt = `
You are an event moderation AI. Evaluate this event and return ONLY valid JSON.

Event:
Title: ${input.title}
Description: ${input.description}
Categories: ${JSON.stringify(input.categories || [])}
Languages: ${JSON.stringify(input.languages || [])}
Location: ${input.city || "unknown"}, ${input.country || "unknown"}

Rules:
- APPROVE if the event is safe, normal, and public.
- REJECT if:
  * Hate speech
  * Sexual/explicit content
  * Illegal activity
  * Violence / extremism
  * Terrorism
  * Fraud / scams
  * Completely nonsensical
- Otherwise, if unclear or borderline, set "needsReview": true.

Return ONLY JSON. NO extra text. Format:

{
  "approved": true/false,
  "needsReview": true/false,
  "reason": "short explanation"
}
`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an event moderation AI. Return ONLY valid JSON, no other text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("AI returned empty response");
    }

    const parsed = extractJson(raw);

    return {
      approved: Boolean(parsed.approved),
      needsReview: Boolean(parsed.needsReview),
      reason: parsed.reason || "",
    };
  } catch (err) {
    console.error("[AI] moderation engine error:", err);

    // Fail-safe → send to admin review
    return {
      approved: false,
      needsReview: true,
      reason: "AI moderation failed – requires manual review",
    };
  }
}

/* -------------------------------------------------------------
   Wrapper used by existing API routes:
   - /api/events/[id]
------------------------------------------------------------- */

export type ModerateEventContentResult = {
  status: "approved" | "rejected" | "flagged";
  reason: string;
  severity_level: "low" | "medium" | "high";
  policy_category: string;
};

export async function moderateEventContent(
  input: ModerateEventInput
): Promise<ModerateEventContentResult> {
  const base = await moderateEvent(input);

  let status: "approved" | "rejected" | "flagged";
  if (base.approved) {
    status = "approved";
  } else if (base.needsReview) {
    status = "flagged";
  } else {
    status = "rejected";
  }

  const severity_level: "low" | "medium" | "high" =
    status === "approved" ? "low" : status === "flagged" ? "medium" : "high";

  const policy_category =
    status === "approved"
      ? "none"
      : "content_policy";

  return {
    status,
    reason: base.reason,
    severity_level,
    policy_category,
  };
}

/* -------------------------------------------------------------
   analyzeEventContent — for admin “Analyze” button
------------------------------------------------------------- */

export async function analyzeEventContent(
  input: ModerateEventInput
): Promise<ModerateEventContentResult & { explanation: string }> {
  const result = await moderateEventContent(input);

  const explanation = `Status: ${result.status.toUpperCase()} — ${result.reason}`;

  return {
    ...result,
    explanation,
  };
}

/* -------------------------------------------------------------
   generateModerationSummary — for /api/admin/summary
   Simple local summary (no extra AI call)
------------------------------------------------------------- */

type SummaryEvent = {
  title: string;
  status: string;
};

export async function generateModerationSummary(events: SummaryEvent[]): Promise<string> {
  const total = events.length;
  const byStatus: Record<string, number> = {};

  for (const e of events) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
  }

  const parts = Object.entries(byStatus).map(
    ([status, count]) => `${status}: ${count}`
  );

  return `Last ${total} events — ${parts.join(", ") || "no events"}.`;
}
