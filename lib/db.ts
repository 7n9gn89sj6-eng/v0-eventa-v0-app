import { PrismaClient } from "@prisma/client"

// Make sure we have a single, clear database URL
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("❌ DATABASE_URL is not set. Please configure it in your environment.")
}

// Reuse PrismaClient in development to avoid exhausting connections
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}

export default db
