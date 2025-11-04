export function detectLang(headers: Headers) {
  const raw = headers.get("accept-language") || ""
  const code = raw.split(",")[0]?.split("-")[0]?.toLowerCase() || "en"
  const supported = new Set(["en", "it", "el", "es", "fr"])
  return supported.has(code) ? code : "en"
}

export function detectLanguage(query: string): string {
  const text = query.toLowerCase()

  // Simple heuristic based on common words
  const patterns: Record<string, RegExp[]> = {
    el: [/[α-ωά-ώ]/], // Greek characters
    it: [/\b(festa|mercato|vino|arte|cibo)\b/],
    es: [/\b(fiesta|mercado|vino|comida)\b/],
    fr: [/\b(fête|marché|vin|nourriture)\b/],
  }

  for (const [lang, regexes] of Object.entries(patterns)) {
    if (regexes.some((regex) => regex.test(text))) {
      return lang
    }
  }

  return "en" // Default to English
}
