export interface NormalizedQuery {
  normalized: string
  synonyms: string[]
  categories: string[]
  intent: string
}

export function normalizeQuery(query: string, _detectedLang?: string): NormalizedQuery {
  const text = (query || "").toLowerCase().trim()

  // Basic synonym mapping for common event terms
  const synonymMap: Record<string, string[]> = {
    market: ["fiesta", "festa", "bazaar", "swap meet", "mercado", "πανηγύρι", "fair", "flea market"],
    festival: ["fiesta", "fest", "φεστιβάλ", "celebration", "carnival"],
    food: ["street food", "night market", "φαγητό", "cuisine", "culinary", "tasting"],
    music: ["concert", "gig", "μουσική", "live music", "performance", "show"],
    art: ["exhibition", "gallery", "τέχνη", "arte", "artwork"],
    wine: ["vino", "κρασί", "vin", "winery", "tasting"],
    traditional: ["folklore", "heritage", "cultural", "παραδοσιακό"],
    outdoor: ["open air", "al fresco", "υπαίθριο"],
  }

  const foundCategories = new Set<string>()
  const foundSynonyms = new Set<string>()

  // Check for matches
  for (const [category, synonyms] of Object.entries(synonymMap)) {
    const allTerms = [category, ...synonyms]
    if (allTerms.some((term) => text.includes(term))) {
      foundCategories.add(category)
      foundSynonyms.add(...synonyms)
    }
  }

  return {
    normalized: text,
    synonyms: Array.from(foundSynonyms),
    categories: Array.from(foundCategories),
    intent: text,
  }
}
