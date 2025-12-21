/**
 * Verification script for Event.language migration
 * 
 * Verifies that the production database has the language column
 * and other required schema elements for the language detection feature.
 */

import { neon } from "@neondatabase/serverless"

async function verifyMigration() {
  console.log("🔍 Verifying language migration...\n")

  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL

    if (!databaseUrl) {
      throw new Error("No database URL found. Set DATABASE_URL or NEON_DATABASE_URL.")
    }

    const sql = neon(databaseUrl)

    // Test connection
    console.log("✓ Connecting to database...")
    await sql`SELECT 1 as test`
    console.log("✓ Database connection successful\n")

    // Check Event table columns
    console.log("📋 Checking Event table columns...")
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'Event'
      AND column_name IN ('language', 'embedding')
      ORDER BY column_name
    `

    const columnMap = new Map(columns.map((c: any) => [c.column_name, c]))

    // Check language column
    console.log("\n1️⃣ Language Column:")
    if (columnMap.has("language")) {
      const langCol = columnMap.get("language")!
      console.log(`   ✅ EXISTS`)
      console.log(`   - Type: ${langCol.data_type}`)
      console.log(`   - Nullable: ${langCol.is_nullable}`)
      if (langCol.is_nullable === "NO") {
        console.log(`   ⚠️  WARNING: Column is NOT NULL - may cause issues with existing events`)
      }
    } else {
      console.log(`   ❌ MISSING - Migration not applied!`)
      process.exit(1)
    }

    // Check embedding column
    console.log("\n2️⃣ Embedding Column:")
    if (columnMap.has("embedding")) {
      const embCol = columnMap.get("embedding")!
      console.log(`   ✅ EXISTS`)
      console.log(`   - Type: ${embCol.data_type}`)
      console.log(`   - Nullable: ${embCol.is_nullable}`)
    } else {
      console.log(`   ⚠️  MISSING - Embedding column not found (may not be critical)`)
    }

    // Check language index
    console.log("\n3️⃣ Language Index:")
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'Event' 
      AND indexname = 'Event_language_idx'
    `
    if (indexes.length > 0) {
      console.log(`   ✅ EXISTS (Event_language_idx)`)
    } else {
      console.log(`   ⚠️  MISSING - Index not created (optional but recommended)`)
    }

    // Check existing events with/without language
    console.log("\n4️⃣ Existing Data Check:")
    const eventStats = await sql`
      SELECT 
        COUNT(*) as total_events,
        COUNT(language) as events_with_language,
        COUNT(*) - COUNT(language) as events_without_language
      FROM "Event"
    `
    const stats = eventStats[0] as any
    console.log(`   - Total events: ${stats.total_events}`)
    console.log(`   - Events with language: ${stats.events_with_language}`)
    console.log(`   - Events without language: ${stats.events_without_language}`)
    
    if (stats.total_events > 0 && stats.events_without_language === stats.total_events) {
      console.log(`   ℹ️  All events are missing language - this is expected for existing events`)
      console.log(`   ℹ️  Language will be detected automatically when events are created/edited`)
    }

    // Check pgvector extension
    console.log("\n5️⃣ pgvector Extension:")
    const extensions = await sql`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'vector'
    `
    if (extensions.length > 0) {
      console.log(`   ✅ EXISTS - Vector extension enabled`)
    } else {
      console.log(`   ⚠️  MISSING - Vector extension not enabled (required for embeddings)`)
    }

    // Summary
    console.log("\n" + "=".repeat(50))
    console.log("✅ VERIFICATION COMPLETE")
    console.log("=".repeat(50))
    
    const hasLanguage = columnMap.has("language")
    const hasEmbedding = columnMap.has("embedding")
    const hasIndex = indexes.length > 0
    const hasVector = extensions.length > 0

    if (hasLanguage) {
      console.log("\n✅ Migration successful! The language column exists.")
      console.log("✅ Search API should now work without 500 errors.")
    } else {
      console.log("\n❌ Migration NOT applied. Please run: npx prisma migrate deploy")
      process.exit(1)
    }

    if (!hasEmbedding) {
      console.log("⚠️  Embedding column missing - semantic search will not work")
    }

    if (!hasVector) {
      console.log("⚠️  Vector extension missing - embeddings cannot be stored")
    }

    console.log("\n📝 Next steps:")
    console.log("   1. Test search API endpoint: /api/search/events")
    console.log("   2. Verify no 500 errors when searching")
    console.log("   3. Language detection will run on new/edited events")

    process.exit(0)
  } catch (error: any) {
    console.error("\n❌ Verification failed:", error.message)
    if (error.message.includes("Can't reach database")) {
      console.error("\n💡 Tip: Check your DATABASE_URL connection string")
      console.error("   Make sure you're using the DIRECT connection (not -pooler)")
    }
    process.exit(1)
  }
}

verifyMigration()

