import { neon } from "@neondatabase/serverless"

async function checkDatabase() {
  console.log("🔍 Checking database connection and schema...")

  try {
    const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("No database URL found. Set NEON_DATABASE_URL or DATABASE_URL.")
    }

    const sql = neon(databaseUrl)

    // Test connection
    console.log("✓ Connecting to database...")
    await sql`SELECT 1 as test`
    console.log("✓ Database connection successful")

    // Check for required tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('User', 'Event', 'EventEditToken')
    `

    const tableNames = tables.map((t: any) => t.table_name)
    console.log("✓ Found tables:", tableNames.join(", "))

    const requiredTables = ["User", "Event", "EventEditToken"]
    const missingTables = requiredTables.filter((t) => !tableNames.includes(t))

    if (missingTables.length > 0) {
      console.error("❌ Missing required tables:", missingTables.join(", "))
      console.log("\nRun: npm run db:migrate:deploy")
      process.exit(1)
    }

    // Check Event table columns
    const eventColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Event'
    `

    console.log("\n✓ Event table columns:")
    eventColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`)
    })

    console.log("\n✅ Database check passed!")
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Database check failed:", error)
    process.exit(1)
  }
}

checkDatabase()
