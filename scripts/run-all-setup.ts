import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL!)

async function runSetup() {
  console.log("[v0] Starting complete database setup...")

  try {
    console.log("[v0] Enabling pgvector extension...")
    await sql`CREATE EXTENSION IF NOT EXISTS vector`
    console.log("[v0] ✓ pgvector enabled")

    console.log("[v0] Creating enum types...")
    await sql`DROP TYPE IF EXISTS "EventStatus" CASCADE`
    await sql`CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')`
    console.log("[v0] ✓ Enum types created")

    console.log("[v0] Creating database tables...")

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

    // Create Account table (for OAuth)
    await sql`
      CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT NOT NULL PRIMARY KEY,
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
        CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE ("provider", "providerAccountId")
      )
    `

    // Create Session table
    await sql`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionToken" TEXT NOT NULL UNIQUE,
        "userId" TEXT NOT NULL,
        "expires" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `

    // Create VerificationToken table
    await sql`
      CREATE TABLE IF NOT EXISTS "VerificationToken" (
        "identifier" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expires" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "VerificationToken_identifier_token_key" UNIQUE ("identifier", "token")
      )
    `

    // Updated EmailVerification table
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

    // Create EventEditToken table
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

    console.log("[v0] ✓ Database tables created")

    console.log("[v0] Creating indexes...")
    await sql`CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx" ON "EmailVerification"("userId")`
    await sql`CREATE INDEX IF NOT EXISTS "EmailVerification_email_idx" ON "EmailVerification"("email")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_city_country_startAt_idx" ON "Event"("city", "country", "startAt")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_startAt_idx" ON "Event"("startAt")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_categories_idx" ON "Event"("categories")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_lat_lng_idx" ON "Event"("lat", "lng")`
    await sql`CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status")`
    await sql`CREATE INDEX IF NOT EXISTS "EventEditToken_eventId_idx" ON "EventEditToken"("eventId")`
    await sql`CREATE INDEX IF NOT EXISTS "EventEditToken_tokenHash_idx" ON "EventEditToken"("tokenHash")`

    await sql`
      CREATE INDEX IF NOT EXISTS idx_event_search 
      ON "Event" USING gin(to_tsvector('simple', "searchText"))
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_event_search_folded 
      ON "Event" USING gin(to_tsvector('simple', "searchTextFolded"))
    `
    console.log("[v0] ✓ Indexes created")

    console.log("[v0] Creating system user for sample events...")
    const systemUserId = "system-sample-events"
    await sql`
      INSERT INTO "User" ("id", "email", "name", "isVerified", "createdAt", "updatedAt")
      VALUES (${systemUserId}, 'system@eventa.app', 'System', true, NOW(), NOW())
      ON CONFLICT ("id") DO NOTHING
    `
    console.log("[v0] ✓ System user created")

    console.log("[v0] Clearing existing sample events...")
    await sql`DELETE FROM "Event" WHERE "createdById" = ${systemUserId}`
    console.log("[v0] ✓ Existing sample events cleared")

    console.log("[v0] Seeding sample events...")

    const events = [
      {
        id: "sample-melbourne-food-wine",
        title: "Melbourne Food & Wine Festival",
        description:
          "Annual celebration of Melbourne's vibrant food and wine culture with tastings, masterclasses, and special dinners.",
        venueName: "Various Venues",
        address: "Multiple locations across Melbourne",
        city: "Melbourne",
        country: "Australia",
        startAt: new Date("2025-03-01T18:00:00+11:00"),
        endAt: new Date("2025-03-15T23:00:00+11:00"),
        categories: ["Food & Drink", "Festival"],
        languages: ["English"],
        status: "PUBLISHED",
        priceFree: false,
        searchText:
          "Melbourne Food & Wine Festival Annual celebration food wine culture tastings masterclasses dinners Various Venues Multiple locations Melbourne Food & Drink Festival English",
        searchTextFolded:
          "melbourne food wine festival annual celebration food wine culture tastings masterclasses dinners various venues multiple locations melbourne food drink festival english",
      },
      {
        id: "sample-sydney-opera-boheme",
        title: "Sydney Opera House: La Bohème",
        description: "Puccini's timeless opera performed by Opera Australia at the iconic Sydney Opera House.",
        venueName: "Sydney Opera House",
        address: "Bennelong Point, Sydney NSW 2000",
        city: "Sydney",
        country: "Australia",
        startAt: new Date("2025-02-20T19:30:00+11:00"),
        endAt: new Date("2025-02-20T22:30:00+11:00"),
        categories: ["Music", "Arts & Culture"],
        languages: ["Italian", "English"],
        status: "PUBLISHED",
        priceFree: false,
        searchText:
          "Sydney Opera House La Bohème Puccini timeless opera Opera Australia iconic Sydney Opera House Bennelong Point Sydney Music Arts Culture Italian English",
        searchTextFolded:
          "sydney opera house la boheme puccini timeless opera opera australia iconic sydney opera house bennelong point sydney music arts culture italian english",
      },
      {
        id: "sample-brisbane-tech-summit",
        title: "Brisbane Tech Summit 2025",
        description:
          "Leading technology conference featuring keynotes from industry experts, workshops, and networking opportunities.",
        venueName: "Brisbane Convention Centre",
        address: "Cnr Merivale & Glenelg Streets, South Brisbane QLD 4101",
        city: "Brisbane",
        country: "Australia",
        startAt: new Date("2025-04-10T09:00:00+10:00"),
        endAt: new Date("2025-04-12T17:00:00+10:00"),
        categories: ["Technology", "Business"],
        languages: ["English"],
        status: "PUBLISHED",
        priceFree: false,
        searchText:
          "Brisbane Tech Summit 2025 technology conference keynotes industry experts workshops networking Brisbane Convention Centre South Brisbane Technology Business English",
        searchTextFolded:
          "brisbane tech summit 2025 technology conference keynotes industry experts workshops networking brisbane convention centre south brisbane technology business english",
      },
      {
        id: "sample-perth-fringe",
        title: "Perth Fringe Festival",
        description:
          "Western Australia's biggest arts festival featuring comedy, cabaret, music, theatre, and visual arts.",
        venueName: "Multiple Venues",
        address: "Various locations in Perth",
        city: "Perth",
        country: "Australia",
        startAt: new Date("2025-01-17T12:00:00+08:00"),
        endAt: new Date("2025-02-16T23:59:00+08:00"),
        categories: ["Arts & Culture", "Festival", "Music"],
        languages: ["English"],
        status: "PUBLISHED",
        priceFree: true,
        searchText:
          "Perth Fringe Festival Western Australia arts festival comedy cabaret music theatre visual arts Multiple Venues Perth Arts Culture Festival Music English",
        searchTextFolded:
          "perth fringe festival western australia arts festival comedy cabaret music theatre visual arts multiple venues perth arts culture festival music english",
      },
      {
        id: "sample-adelaide-writers",
        title: "Adelaide Writers' Week",
        description:
          "Free literary festival in Pioneer Women's Memorial Garden featuring local and international authors.",
        venueName: "Pioneer Women's Memorial Garden",
        address: "King William Road, Adelaide SA 5000",
        city: "Adelaide",
        country: "Australia",
        startAt: new Date("2025-03-01T10:00:00+10:30"),
        endAt: new Date("2025-03-06T17:00:00+10:30"),
        categories: ["Arts & Culture", "Literature"],
        languages: ["English"],
        status: "PUBLISHED",
        priceFree: true,
        searchText:
          "Adelaide Writers Week Free literary festival Pioneer Women Memorial Garden local international authors King William Road Adelaide Arts Culture Literature English",
        searchTextFolded:
          "adelaide writers week free literary festival pioneer women memorial garden local international authors king william road adelaide arts culture literature english",
      },
    ]

    for (const event of events) {
      await sql`
        INSERT INTO "Event" (
          "id", "title", "description", "venueName", "address", "city", "country",
          "startAt", "endAt", "categories", "languages", "status", "priceFree",
          "searchText", "searchTextFolded", "createdById", "createdAt", "updatedAt"
        ) VALUES (
          ${event.id}, ${event.title}, ${event.description}, ${event.venueName}, ${event.address},
          ${event.city}, ${event.country}, ${event.startAt}, ${event.endAt},
          ${event.categories}, ${event.languages}, ${event.status}, ${event.priceFree},
          ${event.searchText}, ${event.searchTextFolded}, ${systemUserId}, NOW(), NOW()
        )
        ON CONFLICT ("id") DO NOTHING
      `
    }

    console.log("[v0] ✓ Sample events seeded")

    // Verify the data
    const count = await sql`SELECT COUNT(*) as count FROM "Event" WHERE "status" = 'PUBLISHED'`
    console.log(`[v0] ✓ Database setup complete! ${count[0].count} published events in database`)
  } catch (error) {
    console.error("[v0] Error during setup:", error)
    throw error
  }
}

runSetup()
