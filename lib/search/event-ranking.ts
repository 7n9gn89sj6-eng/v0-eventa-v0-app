/**
 * Event-First Ranking System
 * 
 * This module implements Google Events-style ranking for event-intent queries.
 * It prioritizes actual, specific events over aggregators, directories, and venue homepages.
 * 
 * Strategy:
 * - Detect event-intent queries (time phrases, activity phrases, travel phrasing)
 * - Score results based on event specificity (dates, venues, locations)
 * - Heavily penalize aggregators/directories
 * - Enforce strict location relevance
 */

/**
 * Detects if a query is clearly event-intent.
 * 
 * Event-intent queries include:
 * - Time phrases: this weekend, tonight, tomorrow, dates
 * - Activity phrases: live music, markets, theatre, concerts
 * - Travel phrasing: while I'm in, during my trip, near me
 * 
 * @param query - The search query
 * @returns true if query appears to be event-intent
 */
export function isEventIntentQuery(query: string): boolean {
  if (!query || query.trim().length === 0) {
    return false
  }

  const queryLower = query.toLowerCase().trim()

  // Time phrases indicating event-intent
  const timePhrases = [
    /\b(this|next)\s+(weekend|week|month|friday|saturday|sunday)\b/i,
    /\btonight|tomorrow|today\b/i,
    /\b\d{1,2}[\/\-]\d{1,2}\b/, // Date patterns like "12/25" or "25-12"
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i,
    /\b(in|on|for)\s+\d+\s+(days?|weeks?|months?)\b/i,
  ]

  // Activity phrases indicating event-intent
  const activityPhrases = [
    /\b(live\s+)?music\b/i,
    /\bmarkets?\b/i,
    /\btheatre|theater\b/i,
    /\bconcerts?\b/i,
    /\bfestivals?\b/i,
    /\bshows?\b/i,
    /\bgigs?\b/i,
    /\bevents?\b/i,
    /\bperformances?\b/i,
    /\bexhibitions?\b/i,
  ]

  // Travel phrasing indicating event-intent
  const travelPhrases = [
    /\bwhile\s+I['']?m\s+in\b/i,
    /\bduring\s+my\s+trip\b/i,
    /\bnear\s+me\b/i,
    /\bnearby\b/i,
    /\baround\s+me\b/i,
  ]

  // Check if query contains any event-intent indicators
  const hasTimeIntent = timePhrases.some(pattern => pattern.test(queryLower))
  const hasActivityIntent = activityPhrases.some(pattern => pattern.test(queryLower))
  const hasTravelIntent = travelPhrases.some(pattern => pattern.test(queryLower))

  // Query is event-intent if it has at least one indicator
  return hasTimeIntent || hasActivityIntent || hasTravelIntent
}

/**
 * Detects if a result is likely an aggregator or directory page.
 * 
 * Aggregators/directories are identified by phrases like:
 * - "What's on", "Browse events", "All concerts"
 * - "Best events in [city]", "Best things to do"
 * - Eventbrite category pages, Facebook pages
 * 
 * @param result - The search result to analyze
 * @returns true if result appears to be an aggregator/directory
 */
function isAggregatorOrDirectory(result: {
  title?: string
  description?: string
  url?: string
  externalUrl?: string
}): boolean {
  const title = (result.title || "").toLowerCase()
  const description = (result.description || "").toLowerCase()
  const url = ((result.url || result.externalUrl) || "").toLowerCase()
  const fullText = `${title} ${description}`.toLowerCase()

  // Phrases that indicate aggregator/directory pages
  const aggregatorPhrases = [
    /\bwhat['']?s\s+on\b/i,
    /\bbrowse\s+events?\b/i,
    /\ball\s+(concerts?|shows?|events?|gigs?)\b/i,
    /\bbest\s+(events?|things\s+to\s+do|concerts?|shows?)\s+(in|at|near)\b/i,
    /\bfind\s+(events?|concerts?|shows?)\b/i,
    /\bdiscover\s+(events?|concerts?|shows?)\b/i,
    /\bsee\s+(all|more)\s+(events?|concerts?|shows?)\b/i,
    /\bevent\s+(calendar|listing|guide|directory)\b/i,
    /\bupcoming\s+events?\s+(in|at)\b/i,
  ]

  // Check if title/description contains aggregator phrases
  const hasAggregatorPhrase = aggregatorPhrases.some(pattern => pattern.test(fullText))

  // Check for aggregator URLs (Eventbrite, Facebook, etc.)
  const isAggregatorUrl = 
    url.includes("eventbrite.com/c/") || // Eventbrite category pages
    url.includes("facebook.com/events") || // Facebook events pages
    url.includes("ticketmaster.com/") ||
    url.includes("ticketek.com.au/") ||
    url.includes("eventful.com/") ||
    url.includes("meetup.com/events") ||
    (url.includes("timeout.com") && fullText.includes("best"))

  return hasAggregatorPhrase || isAggregatorUrl
}

/**
 * Detects if a result is a venue homepage without a specific event.
 * 
 * Venue homepages typically:
 * - Don't have specific dates in the title
 * - Don't mention a specific event name
 * - Have generic phrases like "venue", "location", "contact"
 * 
 * @param result - The search result to analyze
 * @returns true if result appears to be a venue homepage
 */
function isVenueHomepage(result: {
  title?: string
  description?: string
  startAt?: string | Date
}): boolean {
  const title = (result.title || "").toLowerCase()
  const description = (result.description || "").toLowerCase()
  const fullText = `${title} ${description}`.toLowerCase()

  // Check if it has a specific date in title/description (indicates specific event)
  const hasSpecificDate = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(fullText) ||
                         /\b\d{1,2}[\/\-]\d{1,2}/.test(fullText) ||
                         /\b(tonight|tomorrow|this\s+(weekend|week|friday|saturday|sunday))/i.test(fullText)

  // Venue homepage indicators
  const venueHomepagePhrases = [
    /\bhome\s+page\b/i,
    /\bcontact\s+(us|info)\b/i,
    /\babout\s+us\b/i,
    /\bvisit\s+us\b/i,
    /\bget\s+(in\s+)?touch\b/i,
  ]

  const hasVenueHomepagePhrase = venueHomepagePhrases.some(pattern => pattern.test(fullText))
  
  // It's a venue homepage if it has venue homepage phrases and no specific date
  // AND doesn't have startAt (which would indicate a specific event)
  const hasStartAt = !!result.startAt
  
  return hasVenueHomepagePhrase && !hasSpecificDate && !hasStartAt
}

/**
 * Scores a search result for event-first ranking.
 * 
 * Scoring system:
 * +5: Specific event with venue + date
 * +4: Same city/suburb match (when location is specified)
 * +3: Occurring within requested time window
 * -5: Directory / category page
 * -6: Wrong country (when location is specified)
 * -3: Venue homepage without event
 * 
 * @param result - The search result to score
 * @param query - The original search query
 * @param targetCity - Optional target city for location matching
 * @param targetCountry - Optional target country for location matching
 * @returns Score (higher is better)
 */
export function scoreEventResult(
  result: {
    title?: string
    description?: string
    city?: string
    country?: string
    venueName?: string
    address?: string
    startAt?: string | Date
    url?: string
    externalUrl?: string
  },
  query: string,
  targetCity?: string,
  targetCountry?: string
): number {
  let score = 0

  const title = (result.title || "").toLowerCase()
  const description = (result.description || "").toLowerCase()
  const fullText = `${title} ${description}`.toLowerCase()
  const resultCity = (result.city || "").toLowerCase()
  const resultCountry = (result.country || "").toLowerCase()

  // PENALTIES (applied first, can push score negative)

  // -5: Directory / category page
  if (isAggregatorOrDirectory(result)) {
    score -= 5
  }

  // -6: Wrong country (when location is specified)
  if (targetCountry && resultCountry && resultCountry.length > 0) {
    const targetCountryLower = targetCountry.toLowerCase()
    const countryMatches = resultCountry.includes(targetCountryLower) || targetCountryLower.includes(resultCountry)
    if (!countryMatches) {
      score -= 6
    }
  }

  // -3: Venue homepage without event
  if (isVenueHomepage(result)) {
    score -= 3
  }

  // BOOSTS (applied after penalties, can offset but prioritize good results)

  // +5: Specific event with venue + date
  const hasVenue = !!(result.venueName || result.address)
  const hasSpecificDate = !!(result.startAt) || 
                         /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(fullText) ||
                         /\b\d{1,2}[\/\-]\d{1,2}/.test(fullText) ||
                         /\b(tonight|tomorrow|this\s+(weekend|week|friday|saturday|sunday))/i.test(fullText)
  
  if (hasVenue && hasSpecificDate) {
    score += 5
  }

  // +4: Same city/suburb match (when location is specified)
  if (targetCity && resultCity && resultCity.length > 0) {
    const targetCityLower = targetCity.toLowerCase()
    const cityMatches = resultCity.includes(targetCityLower) || targetCityLower.includes(resultCity)
    if (cityMatches) {
      score += 4
    }
  }

  // +3: Occurring within requested time window (if query has time intent)
  if (isEventIntentQuery(query) && result.startAt) {
    try {
      const eventDate = new Date(result.startAt)
      const now = new Date()
      
      // If event is in the future and within 30 days, boost it
      if (eventDate > now) {
        const daysDiff = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        if (daysDiff <= 30) {
          score += 3
        }
      }
    } catch {
      // Invalid date, skip this boost
    }
  }

  return score
}

/**
 * Ranks search results using event-first scoring.
 * 
 * Results are sorted by:
 * 1. Score (higher is better)
 * 2. Date (earlier dates first, if scores are equal)
 * 
 * @param results - Array of search results to rank
 * @param query - The original search query
 * @param targetCity - Optional target city for location matching
 * @param targetCountry - Optional target country for location matching
 * @returns Sorted array of results (best first)
 */
export function rankEventResults<T extends {
  title?: string
  description?: string
  city?: string
  country?: string
  venueName?: string
  address?: string
  startAt?: string | Date
  url?: string
  externalUrl?: string
}>(
  results: T[],
  query: string,
  targetCity?: string,
  targetCountry?: string
): T[] {
  // Only apply event-first ranking if query is event-intent
  if (!isEventIntentQuery(query)) {
    // For non-event queries, just sort by date
    return [...results].sort((a, b) => {
      try {
        const aDate = a.startAt ? new Date(a.startAt).getTime() : 0
        const bDate = b.startAt ? new Date(b.startAt).getTime() : 0
        return aDate - bDate
      } catch {
        return 0
      }
    })
  }

  // Score each result
  const scored = results.map(result => ({
    result,
    score: scoreEventResult(result, query, targetCity, targetCountry),
  }))

  // Sort by score (descending), then by date (ascending)
  scored.sort((a, b) => {
    // First sort by score (higher is better)
    if (b.score !== a.score) {
      return b.score - a.score
    }

    // If scores are equal, sort by date (earlier is better)
    try {
      const aDate = a.result.startAt ? new Date(a.result.startAt).getTime() : 0
      const bDate = b.result.startAt ? new Date(b.result.startAt).getTime() : 0
      return aDate - bDate
    } catch {
      return 0
    }
  })

  // Return sorted results
  return scored.map(item => item.result)
}

