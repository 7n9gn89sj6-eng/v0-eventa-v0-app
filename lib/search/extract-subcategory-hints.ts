/**
 * Deterministic sub-category hints from query text (no AI).
 * Output IDs match `lib/categories/event-subcategories.ts`.
 */

const DEDUPE = (ids: string[]) => [...new Set(ids)]

/**
 * @param query — normalized utterance (same pipeline as parseSearchIntent)
 * @param interests — values from extractInterests (e.g. music, theatre)
 */
export function extractSubcategoryHints(query: string, interests: string[]): string[] {
  const q = query.toLowerCase()
  const out: string[] = []
  const has = (re: RegExp) => re.test(q)
  const interest = (k: string) => interests.includes(k)

  if (/\bhyrox\b/i.test(q) || /\bspartan\s+race\b/i.test(q)) {
    out.push("sports_tri_fitness")
  }

  if (has(/\b(live\s+music|open\s+mic)\b/i) || (interest("music") && has(/\b(gig|concert|band)\b/i))) {
    if (has(/\bopen\s+mic\b/i)) out.push("music_open_mic")
    else out.push("music_live")
  }
  if (has(/\b(techno|house|trance|edm)\b/i) || (interest("music") && has(/\bdj\b/i))) {
    out.push("music_dj_electronic")
  }
  if (has(/\b(jazz|classical|orchestra|symphony)\b/i)) {
    out.push("music_classical_jazz")
  }

  if (has(/\b(farmers?\s+market|producer|growers?|organic)\b/i)) {
    out.push("markets_farmers")
  }
  if (has(/\b(craft|vintage)\b/i) && has(/\b(market|fair)\b/i)) {
    out.push("markets_craft_vintage")
  }
  if (has(/\bnight\s+market\b/i)) {
    out.push("markets_night_market")
  }

  if (has(/\b(musical|west\s+end|broadway)\b/i)) {
    out.push("theatre_musical")
  }
  if (has(/\bopera\b/i)) {
    out.push("theatre_opera")
  }
  if (has(/\b(ballet|contemporary\s+dance|dance\s+performance)\b/i)) {
    out.push("theatre_dance_performance")
  }
  if (
    has(/\bplays?\b/i) &&
    (interest("theatre") || has(/\b(theatre|theater)\b/i))
  ) {
    out.push("theatre_play")
  }

  if (has(/\bstand[-\s]?up|standup\b/i)) {
    out.push("comedy_standup")
  }
  if (has(/\bimprov\b/i)) {
    out.push("comedy_improv")
  }

  if (has(/\b(gallery|opening\s+night)\b/i) && !has(/\bfilm\b/i)) {
    out.push("art_gallery")
  }
  if (has(/\bexhibition\b/i) && !has(/\b(theatre|theater)\b/i)) {
    out.push("art_exhibition")
  }
  if (has(/\bmuseum\b/i)) {
    out.push("art_museum")
  }

  if (has(/\b(5k|10k|marathon|parkrun|fun\s+run)\b/i)) {
    out.push("sports_running")
  }
  if (has(/\b(afl|rugby|soccer|football|basketball|cricket)\b/i)) {
    out.push("sports_team_ball")
  }

  if (has(/\b(wine\s+tasting|beer\s+festival|brewery)\b/i)) {
    out.push("food_drink_wine_beer")
  }
  if (has(/\b(restaurant|dining\s+night)\b/i)) {
    out.push("food_drink_restaurant")
  }

  if (has(/\b(things\s+to\s+do|kids?\s+activities|family\s+fun)\b/i) && interest("kids")) {
    out.push("family_activities")
  }

  return DEDUPE(out)
}
