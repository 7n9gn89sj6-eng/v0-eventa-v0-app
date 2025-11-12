import { neon } from "@neondatabase/serverless"

async function addPostcodeColumn() {
  const sql = neon(process.env.DATABASE_URL!)

  console.log("[v0] Adding postcode column to Event table...")

  try {
    // Add postcode column if it doesn't exist
    await sql`
      ALTER TABLE "Event" 
      ADD COLUMN IF NOT EXISTS "postcode" VARCHAR(16)
    `
    console.log("[v0] ✓ Postcode column added successfully")
  } catch (error) {
    console.error("[v0] Error adding postcode column:", error)
    throw error
  }
}

addPostcodeColumn()
