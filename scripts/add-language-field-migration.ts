/**
 * Migration script to add language field to Event table
 * Run this after updating the Prisma schema
 * 
 * Usage: tsx scripts/add-language-field-migration.ts
 */

import { db } from "@/lib/db"

async function runMigration() {
  try {
    console.log("[migration] Adding language field to Event table...")

    // Add language column
    await db.$executeRawUnsafe(`
      ALTER TABLE "Event" 
      ADD COLUMN IF NOT EXISTS "language" TEXT;
    `)

    console.log("[migration] ✓ Language column added")

    // Add index for language-based filtering
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Event_language_idx" 
      ON "Event"("language");
    `)

    console.log("[migration] ✓ Language index created")
    console.log("[migration] Migration completed successfully")

    process.exit(0)
  } catch (error) {
    console.error("[migration] Migration failed:", error)
    process.exit(1)
  }
}

runMigration()

