/**
 * Backfill script to populate search_text_folded for existing events
 * Run this after adding the search_text_folded column
 */

import { prisma } from "../lib/db"
import { createSearchTextFolded } from "../lib/search/accent-fold"

async function backfillSearchTextFolded() {
  console.log("[v0] Starting backfill of search_text_folded...")

  // Get all events without search_text_folded
  const events = await prisma.event.findMany({
    where: {
      OR: [{ searchTextFolded: null }, { searchTextFolded: "" }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      venueName: true,
      address: true,
      categories: true,
      languages: true,
    },
  })

  console.log(`[v0] Found ${events.length} events to backfill`)

  let updated = 0
  for (const event of events) {
    const searchParts = [
      event.title,
      event.description,
      event.venueName,
      event.address,
      ...event.categories,
      ...event.languages,
    ]

    const searchTextFolded = createSearchTextFolded(searchParts)

    await prisma.event.update({
      where: { id: event.id },
      data: { searchTextFolded },
    })

    updated++
    if (updated % 100 === 0) {
      console.log(`[v0] Updated ${updated}/${events.length} events...`)
    }
  }

  console.log(`[v0] Backfill complete! Updated ${updated} events.`)
}

backfillSearchTextFolded()
  .catch((error) => {
    console.error("[v0] Backfill failed:", error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
