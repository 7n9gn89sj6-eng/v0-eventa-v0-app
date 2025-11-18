import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { DateTime } from "luxon"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let errorCode: string | null = null

  try {
    const body = await request.json()
    const { entities, query, uiLang = "en" } = body

    console.log(`[v0] Internal search request - uiLang: ${uiLang}`, { entities, query })

    let dateFilter: { gte?: Date; lte?: Date } | undefined
    if (entities.date) {
      dateFilter = parseDatePhrase(entities.date)
    }

    const where: any = {
      ...PUBLIC_EVENT_WHERE,
      moderationStatus: "APPROVED", // Keep for backward compatibility
      startAt: dateFilter || { gte: new Date() },
    }

    // City filter
    if (entities.city) {
      where.city = {
        contains: entities.city,
        mode: "insensitive",
      }
    }

    // Venue filter
    if (entities.venue) {
      where.OR = [
        { venueName: { contains: entities.venue, mode: "insensitive" } },
        { locationAddress: { contains: entities.venue, mode: "insensitive" } },
      ]
    }

    if (entities.type || entities.category) {
      const searchCategory = entities.type || entities.category
      const categoryEnum = mapToEventCategory(searchCategory)

      // Search in both category (new) and categories (old) fields
      where.OR = [
        ...(where.OR || []),
        { category: categoryEnum },
        { categories: { hasSome: [searchCategory, categoryEnum] } },
      ]
    }

    console.log("[v0] Search query where clause:", JSON.stringify(where, null, 2))

    // Execute search
    const events = await db.event.findMany({
      where,
      orderBy: [{ startAt: "asc" }],
      take: 20,
    })

    console.log(`[v0] Found ${events.length} events`)

    const rankedEvents = events.map((event) => {
      let score = 0
      const searchTerms = [query, entities.title, entities.type, entities.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      // Title match (weight: 3)
      if (event.title.toLowerCase().includes(searchTerms)) {
        score += 3
      }

      // Category match (weight: 2)
      const eventCategories = [...(event.categories || []), event.category].filter(Boolean)

      if (eventCategories.some((cat) => searchTerms.includes(cat.toLowerCase()))) {
        score += 2
      }

      // Description match (weight: 1)
      if (event.description.toLowerCase().includes(searchTerms)) {
        score += 1
      }

      // Boost for matching city
      if (entities.city && event.city.toLowerCase().includes(entities.city.toLowerCase())) {
        score += 1
      }

      // Boost for date proximity
      if (dateFilter) {
        const eventDate = DateTime.fromJSDate(event.startAt)
        const now = DateTime.now()
        const daysDiff = eventDate.diff(now, "days").days
        if (daysDiff <= 7) score += 2
        else if (daysDiff <= 30) score += 1
      }

      return { ...event, score }
    })

    // Sort by score
    rankedEvents.sort((a, b) => b.score - a.score)

    const latency = Date.now() - startTime

    console.log(
      JSON.stringify({
        phase: "2",
        intent: "SEARCH",
        entities: {
          keywords: query ? [query] : [],
          category: entities.type || entities.category || null,
          city: entities.city || null,
          venue: entities.venue || null,
          date: entities.date || null,
          time: entities.time || null,
        },
        input_mode: body.input_mode || "text",
        ui_lang: uiLang,
        search: {
          source: "internal",
          query_string: JSON.stringify(where),
          results_count: rankedEvents.length,
          latency_ms: latency,
        },
        error_code: errorCode,
      }),
    )

    return NextResponse.json({
      results: rankedEvents,
      count: rankedEvents.length,
      latency_ms: latency,
    })
  } catch (error) {
    console.error("[v0] Internal search error:", error)
    errorCode = "ERR_DB_CONNECT"

    console.log(
      JSON.stringify({
        phase: "2",
        intent: "SEARCH",
        entities: {},
        input_mode: "text",
        search: {
          source: "internal",
          query_string: "",
          results_count: 0,
          latency_ms: Date.now() - startTime,
        },
        error_code: errorCode,
      }),
    )

    return NextResponse.json(
      {
        error: "We couldn't reach Eventa right now. Try again.",
        error_code: errorCode,
        results: [],
        count: 0,
      },
      { status: 500 },
    )
  }
}

function mapToEventCategory(searchTerm: string): string | null {
  const categoryMap: Record<string, string> = {
    arts: "ARTS_CULTURE",
    culture: "ARTS_CULTURE",
    art: "ARTS_CULTURE",
    music: "MUSIC_NIGHTLIFE",
    nightlife: "MUSIC_NIGHTLIFE",
    concert: "MUSIC_NIGHTLIFE",
    jazz: "MUSIC_NIGHTLIFE",
    food: "FOOD_DRINK",
    drink: "FOOD_DRINK",
    restaurant: "FOOD_DRINK",
    family: "FAMILY_KIDS",
    kids: "FAMILY_KIDS",
    children: "FAMILY_KIDS",
    sports: "SPORTS_OUTDOORS",
    outdoors: "SPORTS_OUTDOORS",
    fitness: "SPORTS_OUTDOORS",
    community: "COMMUNITY_CAUSES",
    causes: "COMMUNITY_CAUSES",
    charity: "COMMUNITY_CAUSES",
    learning: "LEARNING_TALKS",
    talks: "LEARNING_TALKS",
    workshop: "LEARNING_TALKS",
    education: "LEARNING_TALKS",
    markets: "MARKETS_FAIRS",
    fairs: "MARKETS_FAIRS",
    market: "MARKETS_FAIRS",
    online: "ONLINE_VIRTUAL",
    virtual: "ONLINE_VIRTUAL",
  }

  const lowerTerm = searchTerm.toLowerCase()
  return categoryMap[lowerTerm] || null
}

function parseDatePhrase(phrase: string): { gte?: Date; lte?: Date } | undefined {
  const now = DateTime.now()
  const lowerPhrase = phrase.toLowerCase()

  if (lowerPhrase.includes("today")) {
    return {
      gte: now.startOf("day").toJSDate(),
      lte: now.endOf("day").toJSDate(),
    }
  }

  if (lowerPhrase.includes("tomorrow")) {
    const tomorrow = now.plus({ days: 1 })
    return {
      gte: tomorrow.startOf("day").toJSDate(),
      lte: tomorrow.endOf("day").toJSDate(),
    }
  }

  if (lowerPhrase.includes("this weekend") || lowerPhrase.includes("weekend")) {
    const daysUntilSaturday = (6 - now.weekday + 7) % 7
    const saturday = now.plus({ days: daysUntilSaturday })
    return {
      gte: saturday.startOf("day").toJSDate(),
      lte: saturday.plus({ days: 1 }).endOf("day").toJSDate(),
    }
  }

  if (lowerPhrase.includes("next month")) {
    const nextMonth = now.plus({ months: 1 })
    return {
      gte: nextMonth.startOf("month").toJSDate(),
      lte: nextMonth.endOf("month").toJSDate(),
    }
  }

  if (lowerPhrase.includes("this month")) {
    return {
      gte: now.startOf("month").toJSDate(),
      lte: now.endOf("month").toJSDate(),
    }
  }

  // Try to parse specific days
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  for (let i = 0; i < days.length; i++) {
    if (lowerPhrase.includes(days[i])) {
      const targetDay = i + 1 // luxon uses 1-7 for Mon-Sun
      let daysUntilTarget = (targetDay - now.weekday + 7) % 7
      if (daysUntilTarget === 0) daysUntilTarget = 7 // Next week if today
      const targetDate = now.plus({ days: daysUntilTarget })
      return {
        gte: targetDate.startOf("day").toJSDate(),
        lte: targetDate.endOf("day").toJSDate(),
      }
    }
  }

  // If we can't parse, return undefined (search without date filter)
  console.log("[v0] Could not parse date phrase:", phrase)
  return undefined
}

function getCategorySynonyms(category: string): string[] {
  const synonymMap: Record<string, string[]> = {
    music: ["Music", "Concert", "Gig", "Live Music", "Performance"],
    jazz: ["Jazz", "Music"],
    exhibition: ["Exhibition", "Expo", "Art Show", "Gallery"],
    expo: ["Exhibition", "Expo", "Trade Show"],
    networking: ["Networking", "Meetup", "Social"],
    meetup: ["Meetup", "Networking", "Social"],
    food: ["Food", "Festival", "Culinary"],
    festival: ["Festival", "Food", "Community", "Cultural"],
    workshop: ["Workshop", "Class", "Training", "Learning"],
    yoga: ["Yoga", "Wellness", "Fitness"],
    sports: ["Sports", "Fitness", "Athletic"],
    tech: ["Tech", "Technology", "IT", "Software"],
    business: ["Business", "Professional", "Corporate"],
    art: ["Art", "Creative", "Cultural"],
    community: ["Community", "Social", "Local"],
  }

  const lower = category.toLowerCase()
  return synonymMap[lower] || [category]
}
