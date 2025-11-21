import { prisma } from "@/lib/db"

async function main() {
  console.log("[fix-event-schema] Starting Event table alignment...")
  console.log("[fix-event-schema] Adding missing columns to match Prisma schema...")

  try {
    // Add all missing columns in a single ALTER TABLE statement
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Event"
        ADD COLUMN IF NOT EXISTS "sourceText" TEXT,
        ADD COLUMN IF NOT EXISTS "category" TEXT,
        ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}'::text[],
        ADD COLUMN IF NOT EXISTS "extractionConfidence" JSONB,
        ADD COLUMN IF NOT EXISTS "organizerName" TEXT,
        ADD COLUMN IF NOT EXISTS "organizerContact" TEXT,
        ADD COLUMN IF NOT EXISTS "aiStatus" TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "aiReason" TEXT,
        ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "editCount" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "moderationReason" TEXT,
        ADD COLUMN IF NOT EXISTS "moderationSeverity" TEXT,
        ADD COLUMN IF NOT EXISTS "moderationCategory" TEXT,
        ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "moderatedBy" TEXT,
        ADD COLUMN IF NOT EXISTS "adminNotes" TEXT,
        ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
        ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP
    `)

    console.log("[fix-event-schema] ✓ Successfully added 21 missing columns")
    console.log("[fix-event-schema] Event table now matches Prisma schema")
    console.log("[fix-event-schema] Alignment complete!")
  } catch (error) {
    console.error("[fix-event-schema] Error while aligning Event schema:", error)
    throw error
  }
}

main()
  .catch((err) => {
    console.error("[fix-event-schema] Fatal error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
