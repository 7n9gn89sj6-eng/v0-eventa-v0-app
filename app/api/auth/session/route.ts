export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server"

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"

/**
 * When auth is disabled we still return valid JSON
 * so next-auth client never crashes parsing "Internal Server Error".
 */
export async function GET() {
  if (!AUTH_ENABLED) {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    return NextResponse.json({
      user: null,
      expires: new Date(Date.now() + thirtyDays).toISOString(),
      disabled: true,
    })
  }
  // If auth is enabled, the catch-all handler should own this route.
  return NextResponse.json({ error: "Auth enabled; catch-all should handle /api/auth/session." }, { status: 400 })
}
