import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * Cron endpoint for automatic event maintenance
 *
 * Tasks:
 * 1. Archive published events that have ended
 * 2. Delete archived events older than 30 days
 *
 * Security: Requires CRON_SECRET in Authorization header
 *
 * Usage: Set up a cron job (e.g., Vercel Cron) to hit this endpoint daily
 * Authorization: Bearer YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization")
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET) {
    console.error("[Cron] CRON_SECRET not configured")
    return NextResponse.json({ error: "Cron endpoint not configured" }, { status: 500 })
  }

  if (authHeader !== expectedAuth) {
    console.warn("[Cron] Unauthorized access attempt")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Task 1: Archive published events that have ended
    const archiveResult = await prisma.event.updateMany({
      where: {
        status: "PUBLISHED",
        endAt: {
          lt: now,
        },
      },
      data: {
        status: "ARCHIVED",
      },
    })

    console.log(`[Cron] Archived ${archiveResult.count} events`)

    // Task 2: Delete archived events older than 30 days
    const deleteResult = await prisma.event.deleteMany({
      where: {
        status: "ARCHIVED",
        endAt: {
          lt: thirtyDaysAgo,
        },
      },
    })

    console.log(`[Cron] Deleted ${deleteResult.count} events`)

    return NextResponse.json({
      success: true,
      archived: archiveResult.count,
      deleted: deleteResult.count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("[Cron] Maintenance failed:", error)
    return NextResponse.json(
      {
        error: "Maintenance failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
