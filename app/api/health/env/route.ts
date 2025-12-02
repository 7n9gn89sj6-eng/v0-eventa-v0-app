import { ok } from "@/lib/http"

export function GET() {
  // In production, don't expose environment variable details for security
  if (process.env.NODE_ENV === "production") {
    return ok({ ok: true })
  }

  // Development only: show missing/available environment variables
  const missing: string[] = []
  const optionalMissing: string[] = []

  // Required variables
  if (!process.env.NEXTAUTH_SECRET) missing.push("NEXTAUTH_SECRET")
  if (!process.env.NEON_DATABASE_URL) missing.push("NEON_DATABASE_URL")

  // Optional variables
  if (!process.env.UPSTASH_KV_REST_API_URL) optionalMissing.push("UPSTASH_KV_REST_API_URL")
  if (!process.env.UPSTASH_KV_REST_API_TOKEN) optionalMissing.push("UPSTASH_KV_REST_API_TOKEN")
  if (!process.env.GOOGLE_API_KEY) optionalMissing.push("GOOGLE_API_KEY")
  if (!process.env.GOOGLE_PSE_ID) optionalMissing.push("GOOGLE_PSE_ID")
  if (!process.env.MAPBOX_TOKEN) optionalMissing.push("MAPBOX_TOKEN")
  if (!process.env.OPENAI_API_KEY) optionalMissing.push("OPENAI_API_KEY")

  return ok({ missing, optionalMissing })
}
