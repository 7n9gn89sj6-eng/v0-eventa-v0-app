import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

export const runtime = "nodejs"

const prisma = new PrismaClient()

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        table_name: string
        column_name: string
        data_type: string
        is_nullable: "YES" | "NO"
      }[]
    >(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema='public'
        AND column_name='postcode'
        AND table_name IN ('Event','Venue','Organizer','UserProfile','Location')
      ORDER BY table_name;
    `)

    return NextResponse.json({ ok: true, rows })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
