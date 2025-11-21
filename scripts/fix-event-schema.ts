import { Client } from "pg"

async function main() {
  console.log("[fix-event-schema] Starting Event table alignment (pg)...")

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }

  const client = new Client({ connectionString: url })

  try {
    await client.connect()
    console.log("[fix-event-schema] Connected to database")

    console.log("[fix-event-schema] Running ALTER TABLE to add missing columns...")

    await client.query(`
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
        ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP;
    `)

    console.log("[fix-event-schema] ✓ Successfully added missing columns via pg")
    console.log("[fix-event-schema] Event table now matches Prisma schema")
    console.log("[fix-event-schema] Alignment complete!")
  } catch (err) {
    console.error("[fix-event-schema] Error aligning Event schema via pg:", err)
    process.exitCode = 1
  } finally {
    await client.end()
    console.log("[fix-event-schema] Connection closed")
  }
}

main()
