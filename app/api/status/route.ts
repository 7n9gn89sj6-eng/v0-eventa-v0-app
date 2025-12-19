import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  const hasSecret = !!process.env.NEXTAUTH_SECRET
  const hasDb = !!process.env.DATABASE_URL || !!process.env.NEON_DATABASE_URL
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGoogle = !!process.env.GOOGLE_API_KEY && !!process.env.GOOGLE_PSE_ID
  const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

  return NextResponse.json({
    ok: true,
    auth: { enabled: authEnabled, hasSecret },
    db: { configured: hasDb },
    openai: { configured: hasOpenAI },
    google: { configured: hasGoogle },
    redis: { configured: hasRedis },
    node: process.versions.node,
  })
}
