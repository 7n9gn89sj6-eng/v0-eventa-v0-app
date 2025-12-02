if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
  console.log("[v0] Skipping run-database-setup in production / Vercel environment")
  process.exit(0)
}

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_DATABASE_URL!)

async function runSetup() {
  console.log("[v0] Starting database setup...\n")

  try {
    // 1. Enable extensions
    console.log("[v0] Step 1: Enabling PostgreSQL extensions...")
    await sql`CREATE EXTENSION IF NOT EXISTS vector`
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`
    console.log("[v0] ✓ Extensions enabled\n")

    // 2. Create enum types
    console.log("[v0] Step 2: Creating enum types...")
    await sql`
      DO $$ BEGIN
        CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `
    console.log("[v0] ✓ Enum types created\n")

    // 3. Create User table
    console.log("[v0] Step 3: Creating User table...")
    await sql`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT UNIQUE NOT NULL,
        "name" TEXT,
        "isVerified" BOOLEAN DEFAULT false NOT NULL,
        "emailVerified" TIMESTAMP,
        "image" TEXT,
        "isAdmin" BOOLEAN DEFAULT false NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `
    console.log("[v0] ✓ User table created\n")

    // 4. Create Account table
    console.log("[v0] Step 4: Creating Account table...")
    await sql`
      CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "providerAccountId" TEXT NOT NULL,
        "refresh_token" TEXT,
        "access_token" TEXT,
        "expires_at" INTEGER,
        "token_type" TEXT,
        "scope" TEXT,
        "id_token" TEXT,
        "session_state" TEXT,
        CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
        UNIQUE("provider", "providerAccountId")
      )
    `
    console.log("[v0] ✓ Account table created\n")

    // 5. Create Session table
    console.log("[v0] Step 5: Creating Session table...")
    await sql`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT PRIMARY KEY,
        "sessionToken" TEXT UNIQUE NOT NULL,
        "userId" TEXT NOT NULL,
        "expires" TIMESTAMP NOT NULL,
        CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )
    `
    console.log("[v0] ✓ Session table created\n")

    // 6. Create VerificationToken table
    console.log("[v0] Step 6: Creating VerificationToken table...")
    await sql`
      CREATE TABLE IF NOT EXISTS "VerificationToken" (
        "identifier" TEXT NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "expires" TIMESTAMP NOT NULL,
        UNIQUE("identifier", "token")
      )
    `
    console.log("[v0] ✓ VerificationToken table created\n")

    // 7. Create EmailVerification table
    console.log("[v0] Step 7: Creating EmailVerification table...")
    await sql`
      CREATE TABLE IF NOT EXISTS "EmailVerification" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "consumedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )
    `
    console.log("[v0] ✓ EmailVerification table created\n")

    // 8. Create Event table
    console.log("[v0] Step 8: Creating Event table...")
    await sql`
      CREATE TABLE IF NOT EXISTS "Event" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "startAt" TIMESTAMP NOT NULL,
        "endAt" TIMESTAMP NOT NULL,
        "locationAddress" TEXT,
        "city" TEXT NOT NULL,
        "country" TEXT NOT NULL,
        "imageUrl" TEXT,
        "externalUrl" TEXT,
        "status" "EventStatus" DEFAULT 'DRAFT' NOT NULL,
        "categories" TEXT[] DEFAULT '{}' NOT NULL,
        "timezone" TEXT DEFAULT 'UTC' NOT NULL,
        "venueName" TEXT,
        "address" TEXT,
        "lat" DOUBLE PRECISION,
        "lng" DOUBLE PRECISION,
        "priceFree" BOOLEAN DEFAULT false NOT NULL,
        "priceAmount" INTEGER,
        "websiteUrl" TEXT,
        "languages" TEXT[] DEFAULT '{}' NOT NULL,
        "imageUrls" TEXT[] DEFAULT '{}' NOT NULL,
        "createdById" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "searchText" TEXT NOT NULL DEFAULT '',
        "searchTextFolded" TEXT,
        "embedding" vector(1536),
        CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE
      )
    `
    console.log("[v0] ✓ Event table created\n")

    // 9. Create EventEditToken table
    console.log("[v0] Step 9: Creating EventEditToken table...")
    await sql`
      CREATE TABLE IF NOT EXISTS "EventEditToken" (
        "id" TEXT PRIMARY KEY,
        "eventId" TEXT NOT NULL,
        "tokenHash" TEXT UNIQUE NOT NULL,
        "expires" TIMESTAMP NOT NULL,
        "usedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "EventEditToken_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
      )
    `
    console.log("[v0] ✓ EventEditToken table created\n")

    // 10. Create all indexes
    console.log("[v0] Step 10: Creating indexes...")
    await sql`CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx" ON "EmailVerification"("userId")`
    await sql`CREATE INDEX IF NOT EXISTS "EmailVerification_email_idx" ON "EmailVerification"("email")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_city_country_startAt_idx" ON "Event"("city", "country", "startAt")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_startAt_idx" ON "Event"("startAt")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_categories_idx" ON "Event"("categories")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_lat_lng_idx" ON "Event"("lat", "lng")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_createdById_idx" ON "Event"("createdById")`
    await sql`CREATE INDEX IF NOT EXISTS "EventEditToken_eventId_idx" ON "EventEditToken"("eventId")`
    await sql`CREATE INDEX IF NOT EXISTS "EventEditToken_tokenHash_idx" ON "EventEditToken"("tokenHash")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_search_text_trgm" ON "Event" USING gin ("searchText" gin_trgm_ops)`
    await sql`CREATE INDEX IF NOT EXISTS "Event_search_text_folded_idx" ON "Event" USING gin(to_tsvector('simple', "searchTextFolded"))`
    await sql`CREATE INDEX IF NOT EXISTS "Event_categories_gin" ON "Event" USING gin ("categories")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_geo_time" ON "Event" ("lat", "lng", "startAt")`
    console.log("[v0] ✓ All indexes created\n")

    console.log("[v0] ✅ Database setup completed successfully!")
    console.log("[v0] All tables, indexes, and extensions are now in place.")
    console.log("[v0] You can now submit events without errors.\n")
  } catch (error) {
    console.error("[v0] ❌ Database setup failed:", error)
    throw error
  }
}

if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "production") {
  runSetup()
}
