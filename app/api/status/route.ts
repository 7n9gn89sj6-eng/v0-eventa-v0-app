import { NextResponse } from "next/server"

export async function GET() {
  const status = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    services: {
      auth: {
        enabled: process.env.NEXT_PUBLIC_AUTH_ENABLED === "true",
        configured: !!(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET !== "placeholder"),
        email: !!(
          process.env.EMAIL_SERVER_HOST &&
          process.env.EMAIL_SERVER_PORT &&
          process.env.EMAIL_SERVER_USER &&
          process.env.EMAIL_SERVER_PASSWORD &&
          process.env.EMAIL_FROM
        ),
      },
      database: {
        configured: !!(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL),
      },
      upstash: {
        configured: !!(process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL),
      },
      google: {
        configured: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_PSE_ID),
        hasPlaceholder: process.env.GOOGLE_PSE_ID === "placeholder",
      },
      mapbox: {
        configured: !!process.env.MAPBOX_TOKEN,
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
      },
    },
  }

  return NextResponse.json(status, { status: 200 })
}
