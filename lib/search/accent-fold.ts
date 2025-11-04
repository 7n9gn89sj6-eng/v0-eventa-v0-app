/**
 * Remove diacritics (accents) from text and normalize for search
 * Examples:
 * - São Paulo → sao paulo
 * - María → maria
 * - Café → cafe
 * - Αθήνα → αθηνα
 */
export function foldAccents(text: string): string {
  return text
    .normalize("NFD") // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .toLowerCase()
    .trim()
}

/**
 * Create search text with accent folding
 */
export function createSearchTextFolded(parts: (string | undefined | null)[]): string {
  return foldAccents(parts.filter(Boolean).join(" "))
}
