import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Query the information_schema to get actual database columns
    const columns = await prisma.$queryRaw<
      Array<{
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }>
    >`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'Event'
      ORDER BY ordinal_position
    `

    return NextResponse.json({
      success: true,
      table: "Event",
      columnCount: columns.length,
      columns: columns,
    })
  } catch (error) {
    console.error("[v0] Schema diagnostic error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
