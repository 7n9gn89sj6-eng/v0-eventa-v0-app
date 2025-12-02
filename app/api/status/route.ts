import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  const hasSecret = !!process.env.NEXTAUTH_SECRET
  const hasDb = !!process.env.DATABASE_URL

  return NextResponse.json({
    ok: true,
    auth: { enabled: authEnabled, hasSecret },
    db: { configured: hasDb },
    node: process.versions.node,
  })
}
