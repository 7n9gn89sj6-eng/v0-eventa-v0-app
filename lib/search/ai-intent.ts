import { z } from "zod"

import { parseSearchIntent } from "./parse-search-intent"
import { parseDateExpression } from "./query-parser"

export type InterpretedSearchIntent = {
  rawQuery: string
  rewrittenTextQuery?: string
  category?: string
  city?: string
  country?: string
  date_from?: string
  date_to?: string
  audience?: string
  price?: "free" | "paid" | null
  confidence?: number
  source: "ai" | "rules" | "fallback"
}

const ALLOWED_CATEGORIES = [
  "music",
  "food",
  "arts",
  "sports",
  "family",
  "community",
  "learning",
  "markets",
  "online",
] as const

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number]
type PriceHint = "free" | "paid" | null

const aiSchema = z.object({
  category: z.enum(ALLOWED_CATEGORIES).optional().nullable(),
  date_from: z.string().optional().nullable(),
  date_to: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  price: z.enum(["free", "paid"]).optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
})

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

type RulesOnlyInterpretation = Omit<InterpretedSearchIntent, "source">

function rulesInterpret(query: string): RulesOnlyInterpretation {
  const rawQuery = query.trim()
  const lower = rawQuery.toLowerCase()

  const { detectedCategory } = parseSearchIntent(rawQuery)
  const dateRange = parseDateExpression(rawQuery)

  const audience =
    /\b(kids|kid|children|child|family)\b/i.test(lower)
      ? "kids"
      : /\b(adult|adults)\b/i.test(lower)
        ? "adults"
        : undefined

  const price: PriceHint =
    /\bfree\b/i.test(lower) ? "free" : /\b(paid|ticket|entry fee|\$)\b/i.test(lower) ? "paid" : null

  let confidence = 0.25
  if (detectedCategory) confidence += 0.35
  if (dateRange.date_from && dateRange.date_to) confidence += 0.35

  const category = (detectedCategory as AllowedCategory | undefined) ?? undefined

  return {
    rawQuery,
    category,
    date_from: dateRange.date_from,
    date_to: dateRange.date_to,
    audience,
    price,
    confidence: clamp01(confidence),
  }
}

/**
 * Thin additive intent interpretation layer for Eventa search.
 *
 * Default behavior:
 * - deterministic rules-only
 *
 * Optional AI:
 * - enabled only when EVENTA_ENABLE_AI_INTENT=true AND OPENAI_API_KEY exists
 * - bounded by a short timeout
 * - fails safely back to deterministic rules
 * - only returns structured hints
 * - never blocks search
 */
export async function interpretSearchIntent(
  query: string,
  context?: { city?: string; country?: string },
): Promise<InterpretedSearchIntent> {
  const rules = rulesInterpret(query)

  const missingCategory = !rules.category || rules.category === "all"
  const missingDate = !(rules.date_from && rules.date_to)
  const shouldTryAI = missingCategory || missingDate

  const openAiEnabled = (process.env.EVENTA_ENABLE_AI_INTENT || "").toLowerCase() === "true"
  const openAiKey = process.env.OPENAI_API_KEY
  const canUseAI = openAiEnabled && Boolean(openAiKey)

  // Rules-only by default; also avoid AI if nothing is missing.
  if (!shouldTryAI || !canUseAI) {
    return {
      ...rules,
      source: "rules",
    }
  }

  const timeoutMsRaw = Number.parseInt(process.env.EVENTA_AI_INTENT_TIMEOUT_MS || "1400", 10)
  const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(400, timeoutMsRaw) : 1400

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()

  try {
    const { generateObject } = (await import("ai")) as any
    const { createOpenAI } = (await import("@ai-sdk/openai")) as any

    const openai = createOpenAI({ apiKey: openAiKey })

    timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    const aiResult = await Promise.race([
      (async () => {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: aiSchema,
          prompt: `
You are an event search intent interpreter for Eventa.

Task:
Infer structured search hints for Eventa from a user's plain-language query.

Hard constraints:
- Do NOT rewrite the user's query; return only structured hints.
- Do NOT infer city/country unless the user explicitly mentions them.
- Infer ONLY structured hints that fit the schema.
- If unsure, return null/unknown (omit optional fields or set to null).

User query:
"${rules.rawQuery}"

Optional context (do not override user intent):
city=${context?.city ?? "(none)"}
country=${context?.country ?? "(none)"}
          `.trim(),
          signal: controller.signal,
        })
        return object as z.infer<typeof aiSchema>
      })(),
      new Promise<z.infer<typeof aiSchema>>((_, reject) => {
        const timeoutSoftMs = timeoutMs + 120
        const id = setTimeout(() => reject(new Error("EVENTA_AI_INTENT_TIMEOUT")), timeoutSoftMs)
        // Ensure this timeout is cleaned up if the model finishes first.
        return () => clearTimeout(id)
      }),
    ])

    return {
      rawQuery: rules.rawQuery,
      category: rules.category ?? (aiResult.category ?? undefined),
      date_from: rules.date_from ?? (aiResult.date_from ?? undefined),
      date_to: rules.date_to ?? (aiResult.date_to ?? undefined),
      audience: rules.audience ?? (aiResult.audience ?? undefined),
      price: rules.price ?? ((aiResult.price ?? null) as PriceHint),
      confidence: clamp01(Math.max(rules.confidence ?? 0.25, aiResult.confidence ?? 0.25)),
      source: "ai",
    }
  } catch {
    // Fail safely to rules; never block search.
    return {
      ...rules,
      source: "fallback",
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

