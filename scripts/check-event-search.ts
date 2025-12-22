import { PrismaClient } from "@prisma/client"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"

const prisma = new PrismaClient()

async function checkEvent() {
  const searchQuery = "Brussels Xmas Market"
  const searchCity = "Brussels"
  
  console.log("🔍 Checking for event matching:", searchQuery)
  console.log("=" .repeat(60))
  
  try {
    // 1. Check if any events exist with "Brussels" in title or city
    console.log("\n1️⃣ Searching for events with 'Brussels' in title or city...")
    const brusselsEvents = await prisma.event.findMany({
      where: {
        OR: [
          { title: { contains: "Brussels", mode: "insensitive" } },
          { city: { contains: "Brussels", mode: "insensitive" } },
          { title: { contains: "Xmas", mode: "insensitive" } },
          { title: { contains: "Market", mode: "insensitive" } },
        ]
      },
      select: {
        id: true,
        title: true,
        city: true,
        country: true,
        status: true,
        moderationStatus: true,
        aiStatus: true,
        startAt: true,
        createdAt: true,
        searchText: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    
    console.log(`Found ${brusselsEvents.length} events with 'Brussels' or 'Xmas' or 'Market':`)
    brusselsEvents.forEach((event, i) => {
      console.log(`\n  Event ${i + 1}:`)
      console.log(`    ID: ${event.id}`)
      console.log(`    Title: ${event.title}`)
      console.log(`    City: ${event.city}`)
      console.log(`    Country: ${event.country || "N/A"}`)
      console.log(`    Status: ${event.status}`)
      console.log(`    ModerationStatus: ${event.moderationStatus || "NULL"}`)
      console.log(`    AIStatus: ${event.aiStatus || "NULL"}`)
      console.log(`    StartAt: ${event.startAt}`)
      console.log(`    CreatedAt: ${event.createdAt}`)
      console.log(`    SearchText: ${event.searchText?.substring(0, 100) || "EMPTY"}...`)
      
      // Check if it matches PUBLIC_EVENT_WHERE
      const matchesPublic = event.status === "PUBLISHED" && event.moderationStatus === "APPROVED"
      console.log(`    ✅ Matches PUBLIC_EVENT_WHERE: ${matchesPublic ? "YES" : "NO"}`)
      
      if (!matchesPublic) {
        console.log(`    ❌ REASON: `, {
          statusMatch: event.status === "PUBLISHED" ? "✓" : "✗",
          moderationMatch: event.moderationStatus === "APPROVED" ? "✓" : "✗",
        })
      }
    })
    
    // 2. Check what PUBLIC_EVENT_WHERE would return
    console.log("\n2️⃣ Checking events that match PUBLIC_EVENT_WHERE...")
    const publicEvents = await prisma.event.findMany({
      where: PUBLIC_EVENT_WHERE,
      select: {
        id: true,
        title: true,
        city: true,
        status: true,
        moderationStatus: true,
      },
      take: 5,
    })
    console.log(`Found ${publicEvents.length} public events (showing first 5)`)
    
    // 3. Test the actual search query
    console.log("\n3️⃣ Testing search query with word-by-word matching...")
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)
    console.log("Query words:", queryWords)
    
    // Simulate the search logic
    const where: any = {
      ...PUBLIC_EVENT_WHERE,
      startAt: { gte: new Date() },
    }
    
    // Add text search conditions
    const textSearchConditions: any[] = []
    queryWords.forEach(word => {
      textSearchConditions.push({
        OR: [
          { title: { contains: word, mode: "insensitive" } },
          { description: { contains: word, mode: "insensitive" } },
          { venueName: { contains: word, mode: "insensitive" } },
        ]
      })
    })
    
    if (textSearchConditions.length > 0) {
      where.AND = where.AND || []
      where.AND.push(...textSearchConditions)
    }
    
    console.log("Where clause structure:", JSON.stringify(where, null, 2))
    
    const searchResults = await prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        city: true,
        startAt: true,
      },
      take: 5,
    })
    
    console.log(`\nSearch results: ${searchResults.length} events found`)
    searchResults.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.title} (${event.city})`)
    })
    
    // 4. Check if city filter would help
    if (searchCity) {
      console.log(`\n4️⃣ Testing with city filter: "${searchCity}"...`)
      const whereWithCity = {
        ...where,
        city: { contains: searchCity, mode: "insensitive" },
      }
      
      const cityFilteredResults = await prisma.event.findMany({
        where: whereWithCity,
        select: {
          id: true,
          title: true,
          city: true,
          startAt: true,
        },
        take: 5,
      })
      
      console.log(`City-filtered results: ${cityFilteredResults.length} events found`)
      cityFilteredResults.forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.title} (${event.city})`)
      })
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    if (error.message.includes("column") || error.message.includes("does not exist")) {
      console.error("\n⚠️ This might be a schema issue. Check if all migrations are applied.")
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkEvent()

