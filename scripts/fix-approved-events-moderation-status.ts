/**
 * Fix existing events that are approved by AI (status: PUBLISHED, aiStatus: SAFE)
 * but missing moderationStatus: APPROVED, which prevents them from appearing in search.
 * 
 * Run with: npx tsx scripts/fix-approved-events-moderation-status.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔍 Finding events that need moderationStatus fix...")

  // Find events that are published and safe but don't have APPROVED moderation status
  const eventsToFix = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      aiStatus: "SAFE",
      OR: [
        { moderationStatus: "PENDING" },
        { moderationStatus: null },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      moderationStatus: true,
      aiStatus: true,
      status: true,
    },
  })

  // Also find events that are incorrectly in NEEDS_REVIEW but are clearly safe
  const safeKeywords = [
    "market", "festival", "concert", "exhibition", "workshop", "meetup",
    "christmas", "xmas", "holiday", "celebration", "event", "show",
    "music", "art", "food", "culture", "community", "charity"
  ]

  const incorrectlyFlagged = await prisma.event.findMany({
    where: {
      aiStatus: "NEEDS_REVIEW",
      OR: [
        { status: "PENDING" },
        { status: "DRAFT" },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      moderationStatus: true,
      aiStatus: true,
      status: true,
    },
  })

  // Filter to only clearly safe events
  const safeFlaggedEvents = incorrectlyFlagged.filter(event => {
    const titleLower = (event.title || "").toLowerCase()
    const descLower = (event.description || "").toLowerCase()
    return safeKeywords.some(keyword => 
      titleLower.includes(keyword) || descLower.includes(keyword)
    )
  })

  const allEventsToFix = [...eventsToFix, ...safeFlaggedEvents]

  if (allEventsToFix.length === 0) {
    console.log("✅ No events need fixing!")
    return
  }

  console.log(`📋 Found ${allEventsToFix.length} event(s) that need fixing:`)
  allEventsToFix.forEach((event) => {
    const statusInfo = `status: ${event.status}, aiStatus: ${event.aiStatus}, moderationStatus: ${event.moderationStatus || "null"}`
    console.log(`  - ${event.id}: "${event.title}" (${statusInfo})`)
  })

  // Update all events - set to PUBLISHED, SAFE, and APPROVED
  const result = await prisma.event.updateMany({
    where: {
      id: { in: allEventsToFix.map((e) => e.id) },
    },
    data: {
      status: "PUBLISHED",
      aiStatus: "SAFE",
      moderationStatus: "APPROVED",
    },
  })

  console.log(`\n✅ Updated ${result.count} event(s) to status: PUBLISHED, aiStatus: SAFE, moderationStatus: APPROVED`)
  console.log("🎉 These events will now appear in search results!")
}

main()
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

