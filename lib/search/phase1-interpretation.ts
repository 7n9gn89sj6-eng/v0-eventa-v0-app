import type { InterpretedSearchIntent } from "@/lib/search/ai-intent"

export type Phase1Facet =
  | { kind: "execution_time"; dateFrom: string; dateTo: string }
  | { kind: "execution_place"; city: string | null; country: string | null }
  | { kind: "deterministic_topic"; topic: string }
  | { kind: "ai_suggestion"; displayLabel: string; confidence?: number }

export type Phase1Interpretation = {
  schemaVersion: 1
  meta: { aiAttempted: boolean; aiSucceeded: boolean }
  facets: Phase1Facet[]
}

type ParsedIntentForPhase1 = { interest?: string[] | null }

export type BuildPhase1InterpretationInput = {
  q: string
  interpreted: InterpretedSearchIntent | null
  interpretThrew: boolean
  executionCategory: string | null
  executionDateFrom: string | null
  executionDateTo: string | null
  executionPlace: { city: string | null; country: string | null }
  parsedIntent: ParsedIntentForPhase1
}

function normalizeCategoryToken(c: string | undefined | null): string | null {
  if (!c || !c.trim()) return null
  const t = c.trim().toLowerCase()
  if (t === "all") return null
  return t
}

/** True when both ranges are valid and do not overlap (inclusive endpoints). */
export function dateRangesNonOverlapping(
  execFrom: string,
  execTo: string,
  aiFrom: string,
  aiTo: string,
): boolean {
  const e0 = new Date(execFrom).getTime()
  const e1 = new Date(execTo).getTime()
  const a0 = new Date(aiFrom).getTime()
  const a1 = new Date(aiTo).getTime()
  if ([e0, e1, a0, a1].some(Number.isNaN)) return false
  const overlaps = !(e1 < a0 || a1 < e0)
  return !overlaps
}

export function categoriesDisagree(
  executionCategory: string | null,
  aiCategory: string | undefined,
): boolean {
  const e = normalizeCategoryToken(executionCategory)
  const a = normalizeCategoryToken(aiCategory ?? null)
  if (!e || !a) return false
  return e !== a
}

function formatDateRangeEn(fromIso: string, toIso: string): string {
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
  const d0 = new Date(fromIso)
  const d1 = new Date(toIso)
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) return ""
  return `${d0.toLocaleDateString("en-US", o)} – ${d1.toLocaleDateString("en-US", o)}`
}

function buildAiSuggestionDisplayLabel(
  interpreted: InterpretedSearchIntent,
  executionCategory: string | null,
  executionDateFrom: string | null,
  executionDateTo: string | null,
): string | null {
  const aiFrom = interpreted.date_from
  const aiTo = interpreted.date_to
  const dateDisagrees =
    Boolean(executionDateFrom && executionDateTo && aiFrom && aiTo) &&
    dateRangesNonOverlapping(executionDateFrom!, executionDateTo!, aiFrom!, aiTo!)

  const catDisagrees = categoriesDisagree(executionCategory, interpreted.category)

  if (dateDisagrees) {
    const formatted = formatDateRangeEn(aiFrom!, aiTo!)
    if (!formatted) return null
    return `Suggested: ${formatted} (not used for results)`
  }
  if (catDisagrees && interpreted.category) {
    return `Suggested: ${interpreted.category} (not used for results)`
  }
  return null
}

export function buildPhase1Interpretation(input: BuildPhase1InterpretationInput): Phase1Interpretation {
  const trimmedQ = input.q.trim()
  const aiAttempted = trimmedQ.length > 0
  const aiSucceeded = aiAttempted && !input.interpretThrew && input.interpreted !== null

  const facets: Phase1Facet[] = []

  if (input.executionDateFrom && input.executionDateTo) {
    facets.push({
      kind: "execution_time",
      dateFrom: input.executionDateFrom,
      dateTo: input.executionDateTo,
    })
  }

  if (input.executionPlace.city?.trim() || input.executionPlace.country?.trim()) {
    facets.push({
      kind: "execution_place",
      city: input.executionPlace.city?.trim() ? input.executionPlace.city : null,
      country: input.executionPlace.country?.trim() ? input.executionPlace.country : null,
    })
  }

  const topic = input.parsedIntent.interest?.[0]?.trim()
  if (topic) {
    facets.push({ kind: "deterministic_topic", topic })
  }

  const interpreted = input.interpreted
  if (interpreted && interpreted.source === "ai") {
    const displayLabel = buildAiSuggestionDisplayLabel(
      interpreted,
      input.executionCategory,
      input.executionDateFrom,
      input.executionDateTo,
    )
    if (displayLabel) {
      facets.push({
        kind: "ai_suggestion",
        displayLabel,
        confidence:
          typeof interpreted.confidence === "number" ? interpreted.confidence : undefined,
      })
    }
  }

  return {
    schemaVersion: 1,
    meta: { aiAttempted, aiSucceeded },
    facets,
  }
}
