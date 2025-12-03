"use server";

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* -------------------------------------------------------------
   Utility: Remove ```json code fences & extract valid JSON
------------------------------------------------------------- */
function extractJson(text: string) {
  if (!text) throw new Error("Empty AI response");

  // Remove fences like ```json ... ```
  let cleaned = text
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
   MODERATION ENGINE
------------------------------------------------------------- */
export async function moderateEvent(input: {
  title: string;
  description: string;
  categories?: string[];
  languages?: string[];
  city?: string | null;
  country?: string | null;
}) {
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
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 200,
    });

    const raw = response.output_text;
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
