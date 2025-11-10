export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

/**
 * Minimal, safe submit route.
 * - Never .map() on undefined
 * - Accepts JSON { address?: string } to prove build/runtime are OK
 */
export async function POST(request: Request) {
  // Safely read JSON
  const body = await request.json().catch(() => ({} as any))
  const address = typeof body?.address === 'string' ? body.address : ''

  // Safe split + map (address is always a string here)
  const addressParts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  // Return something simple
  return NextResponse.json({
    ok: true,
    received: { address },
    parsed: { addressParts },
  })
}

// Optional GET to make it easy to probe in browser
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/events/submit' })
}
