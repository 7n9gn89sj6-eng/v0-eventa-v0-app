/**
 * Allowlisted typo repairs for high-frequency discovery phrases only.
 * Runs before utterance normalization / intent parsing so malformed tokens
 * (e.g. "os" instead of "on") are not required in DB text search.
 */

/** Longest / most specific patterns first. */
const DISCOVERY_PHRASE_REPAIRS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bwhat'?s\s+os\b/gi, replacement: "whats on" },
  { pattern: /\bwhat\s+os\b/gi, replacement: "whats on" },
  { pattern: /\bwhats\s+om\b/gi, replacement: "whats on" },
  { pattern: /\bwhats\s+os\b/gi, replacement: "whats on" },
]

export function repairDiscoveryPhrases(input: string): string {
  let s = String(input ?? "")
  if (!s.trim()) return s

  for (const { pattern, replacement } of DISCOVERY_PHRASE_REPAIRS) {
    s = s.replace(pattern, replacement)
  }
  return s.replace(/\s+/g, " ").trim()
}
