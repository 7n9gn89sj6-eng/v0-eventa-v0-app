import { NextResponse } from "next/server"

/**
 * Health check and configuration status endpoint
 * Useful for debugging environment variable issues
 */
export async function GET() {
  // In production, don't expose sensitive details
  const isProduction = process.env.NODE_ENV === "production"

  const status = {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    services: {
      database: {
        configured: !!process.env.DATABASE_URL,
        // Don't expose full connection string
        hasUrl: !!process.env.DATABASE_URL,
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        hasApiKey: !!process.env.OPENAI_API_KEY,
      },
      google: {
        searchApiKey: !!process.env.GOOGLE_API_KEY,
        pseId: !!process.env.GOOGLE_PSE_ID,
        mapsApiKey: {
          configured: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
          // Only show if API key exists (don't show full key, just first few chars)
          preview: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            ? `${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.substring(0, 10)}...`
            : "NOT SET",
          note: "Used for Places Autocomplete in address fields",
        },
      },
      redis: {
        configured: !!process.env.UPSTASH_KV_REST_API_URL && !!process.env.UPSTASH_KV_REST_API_TOKEN,
        hasUrl: !!process.env.UPSTASH_KV_REST_API_URL,
        hasToken: !!process.env.UPSTASH_KV_REST_API_TOKEN,
      },
      mapbox: {
        configured: !!process.env.MAPBOX_TOKEN,
        hasToken: !!process.env.MAPBOX_TOKEN,
      },
    },
  }

  // In production, hide sensitive information
  if (isProduction) {
    // Only return basic status
    return NextResponse.json({
      ok: true,
      environment: status.environment,
      timestamp: status.timestamp,
      services: {
        database: { configured: status.services.database.configured },
        openai: { configured: status.services.openai.configured },
        google: {
          searchConfigured: status.services.google.searchApiKey && status.services.google.pseId,
          mapsConfigured: status.services.google.mapsApiKey.configured,
        },
        redis: { configured: status.services.redis.configured },
        mapbox: { configured: status.services.mapbox.configured },
      },
    })
  }

  // In development, show more details
  return NextResponse.json(status)
}
