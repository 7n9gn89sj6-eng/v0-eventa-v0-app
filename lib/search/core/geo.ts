/**
 * Geo heuristics for **canonical** web-result filtering on GET /api/search/events.
 * Legacy routes keep their own copies until removed.
 */

export function hasAustraliaIndicators(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return /\b(australia|australian|au|melbourne|sydney|brisbane|perth|adelaide|canberra|darwin|vic|victoria|naarm|tasmania|queensland|nsw|new south wales|western australia|wa|south australia|sa|northern territory|nt|australian capital territory|act)\b/i.test(
    lower,
  )
}

export function hasUSIndicatorsInText(text: string): boolean {
  return /\b(usa|united states|us|america|u\.s\.|u\.s\.a\.)\b/i.test(text)
}
