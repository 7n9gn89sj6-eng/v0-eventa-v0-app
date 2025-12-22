import { PrismaClient } from "@prisma/client"

// Make sure we have a single, clear database URL
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not set in process.env")
  console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes("DATABASE") || k.includes("DB")))
  throw new Error("❌ DATABASE_URL is not set. Please configure it in your .env.local file and restart the dev server.")
}

if (databaseUrl.trim() === "") {
  throw new Error("❌ DATABASE_URL is set but empty. Please check your .env.local file.")
}

// Reuse PrismaClient in development to avoid exhausting connections
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

// Log connection details in development (without exposing password)
if (process.env.NODE_ENV === "development") {
  try {
    const urlParts = databaseUrl.split("@")
    const hostPart = urlParts.length > 1 ? urlParts[1].split("/")[0] : "unknown"
    const isPooled = hostPart.includes("pooler")
    console.log("[db] Initializing Prisma Client")
    console.log("[db] Connection host:", hostPart)
    console.log("[db] Using pooled connection:", isPooled)
    
    if (isPooled) {
      console.error("❌ WARNING: Using pooled connection! This will cause authentication errors.")
      console.error("❌ Please update .env.local with direct connection string (no -pooler)")
      console.error("❌ Then restart the dev server completely.")
    }
  } catch (e) {
    console.warn("[db] Could not parse connection string for logging")
  }
}

// Force clear cached Prisma client if it exists and we're using pooled connection
if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  const urlParts = databaseUrl.split("@")
  const hostPart = urlParts.length > 1 ? urlParts[1].split("/")[0] : ""
  if (hostPart.includes("pooler")) {
    console.log("[db] Clearing cached Prisma client - switching to direct connection")
    try {
      globalForPrisma.prisma.$disconnect().catch(() => {})
    } catch (e) {
      // Ignore disconnect errors
    }
    globalForPrisma.prisma = undefined
  }
}

let db: PrismaClient
try {
  db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
  })
} catch (error) {
  console.error("[db] Failed to create Prisma Client:", error)
  throw error
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}

// Export both default and named export for compatibility
export { db }
export default db
