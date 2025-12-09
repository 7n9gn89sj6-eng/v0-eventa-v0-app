import { PrismaClient } from "@prisma/client"

// Prefer NEON_DATABASE_URL first, fall back to DATABASE_URL if needed
const databaseUrl =
  process.env.NEON_DATABASE_URL ??
  process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("❌ No database URL found. Set NEON_DATABASE_URL or DATABASE_URL.")
}

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

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export const db = prisma

export default prisma
