import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL!)

async function runSetup() {
  console.log("[v0] Starting complete database setup...")

  try {
    console.log("[v0] Creating database tables...")

    // Create User table
    await sql`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT,
        "email" TEXT UNIQUE,
        "emailVerified" TIMESTAMP(3),
        "image" TEXT,
        "isAdmin" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
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

    // Create EmailVerification table
    await sql`
      CREATE TABLE IF NOT EXISTS "EmailVerification" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "email" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expires" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create Event table
    await sql`
      CREATE TABLE IF NOT EXISTS "Event" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "venueName" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "city" TEXT NOT NULL,
        "country" TEXT NOT NULL,
        "startAt" TIMESTAMP(3) NOT NULL,
        "endAt" TIMESTAMP(3) NOT NULL,
        "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "imageUrl" TEXT,
        "externalUrl" TEXT,
        "organizerName" TEXT NOT NULL,
        "organizerEmail" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "searchText" TEXT NOT NULL DEFAULT '',
        "searchTextFolded" TEXT NOT NULL DEFAULT '',
        "archived" BOOLEAN NOT NULL DEFAULT false,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Event_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `

    // Create EventEditToken table
    await sql`
      CREATE TABLE IF NOT EXISTS "EventEditToken" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "eventId" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EventEditToken_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `

    console.log("[v0] ✓ Database tables created")

    // 1. Enable pgvector extension
    console.log("[v0] Enabling pgvector extension...")
    await sql`CREATE EXTENSION IF NOT EXISTS vector`
    console.log("[v0] ✓ pgvector enabled")

    // 2. Create search indexes
    console.log("[v0] Creating search indexes...")
    await sql`
      CREATE INDEX IF NOT EXISTS idx_event_search 
      ON "Event" USING gin(to_tsvector('simple', "searchText"))
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_event_search_folded 
      ON "Event" USING gin(to_tsvector('simple', "searchTextFolded"))
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_event_dates 
      ON "Event"("startAt", "endAt")
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_event_location 
      ON "Event"("city", "country")
    `
    console.log("[v0] ✓ Search indexes created")

    // 3. Clear existing sample events (optional - remove if you want to keep existing data)
    console.log("[v0] Clearing existing sample events...")
    await sql`DELETE FROM "Event" WHERE "organizerEmail" LIKE '%@example.com'`
    console.log("[v0] ✓ Existing sample events cleared")

    // 4. Seed sample events
    console.log("[v0] Seeding sample events...")

    const events = [
      {
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
        organizerName: "Melbourne Food & Wine",
        organizerEmail: "info@melbournefoodandwine.com.au",
        status: "PUBLISHED",
        searchText:
          "Melbourne Food & Wine Festival Annual celebration food wine culture tastings masterclasses dinners Various Venues Multiple locations Melbourne Food & Drink Festival English",
        searchTextFolded:
          "melbourne food wine festival annual celebration food wine culture tastings masterclasses dinners various venues multiple locations melbourne food drink festival english",
      },
      {
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
        organizerName: "Opera Australia",
        organizerEmail: "tickets@opera.org.au",
        status: "PUBLISHED",
        searchText:
          "Sydney Opera House La Bohème Puccini timeless opera Opera Australia iconic Sydney Opera House Bennelong Point Sydney Music Arts Culture Italian English",
        searchTextFolded:
          "sydney opera house la boheme puccini timeless opera opera australia iconic sydney opera house bennelong point sydney music arts culture italian english",
      },
      {
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
        organizerName: "Tech Summit Australia",
        organizerEmail: "contact@techsummit.com.au",
        status: "PUBLISHED",
        searchText:
          "Brisbane Tech Summit 2025 technology conference keynotes industry experts workshops networking Brisbane Convention Centre South Brisbane Technology Business English",
        searchTextFolded:
          "brisbane tech summit 2025 technology conference keynotes industry experts workshops networking brisbane convention centre south brisbane technology business english",
      },
      {
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
        organizerName: "Fringe World",
        organizerEmail: "info@fringeworld.com.au",
        status: "PUBLISHED",
        searchText:
          "Perth Fringe Festival Western Australia arts festival comedy cabaret music theatre visual arts Multiple Venues Perth Arts Culture Festival Music English",
        searchTextFolded:
          "perth fringe festival western australia arts festival comedy cabaret music theatre visual arts multiple venues perth arts culture festival music english",
      },
      {
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
        organizerName: "Adelaide Festival",
        organizerEmail: "info@adelaidefestival.com.au",
        status: "PUBLISHED",
        searchText:
          "Adelaide Writers Week Free literary festival Pioneer Women Memorial Garden local international authors King William Road Adelaide Arts Culture Literature English",
        searchTextFolded:
          "adelaide writers week free literary festival pioneer women memorial garden local international authors king william road adelaide arts culture literature english",
      },
    ]

    for (const event of events) {
      await sql`
        INSERT INTO "Event" (
          "title", "description", "venueName", "address", "city", "country",
          "startAt", "endAt", "categories", "languages",
          "organizerName", "organizerEmail", "status",
          "searchText", "searchTextFolded", "createdAt", "updatedAt"
        ) VALUES (
          ${event.title}, ${event.description}, ${event.venueName}, ${event.address},
          ${event.city}, ${event.country}, ${event.startAt}, ${event.endAt},
          ${event.categories}, ${event.languages}, ${event.organizerName},
          ${event.organizerEmail}, ${event.status}, ${event.searchText},
          ${event.searchTextFolded}, NOW(), NOW()
        )
      `
    }

    console.log("[v0] ✓ Sample events seeded")

    // 5. Verify the data
    const count = await sql`SELECT COUNT(*) as count FROM "Event" WHERE "status" = 'PUBLISHED'`
    console.log(`[v0] ✓ Database setup complete! ${count[0].count} published events in database`)
  } catch (error) {
    console.error("[v0] Error during setup:", error)
    throw error
  }
}

runSetup()
