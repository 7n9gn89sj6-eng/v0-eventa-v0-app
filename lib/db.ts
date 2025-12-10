import { PrismaClient } from "@prisma/client"

// Use only one environment variable for DB
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("❌ DATABASE_URL is not set in environment variables.")
}

// Prevent multiple instances during hot reload in dev
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export const db = prisma
export default prisma

