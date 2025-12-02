import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("[v0] Starting database setup...")

  try {
    // Test database connection
    await prisma.$connect()
    console.log("[v0] Database connection successful")

    // Check if tables exist by trying to count users
    const userCount = await prisma.user.count()
    console.log(`[v0] Database is ready. Found ${userCount} users.`)
  } catch (error) {
    console.error("[v0] Database setup error:", error)
    console.log("\n[v0] Please run: npx prisma db push")
    console.log("[v0] This will create all the necessary database tables.")
  } finally {
    await prisma.$disconnect()
  }
}

main()
