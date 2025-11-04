import { ok } from "@/lib/http"

export function GET() {
  // In production, don't expose environment variable details for security
  if (process.env.NODE_ENV === "production") {
    return ok({ ok: true })
  }

  // Development only: show missing/available environment variables
  const reqd = ["NEXTAUTH_SECRET", "NEON_DATABASE_URL"]
  const opt = [
    "UPSTASH_KV_REST_API_URL",
    "UPSTASH_KV_REST_API_TOKEN",
    "GOOGLE_API_KEY",
    "GOOGLE_PSE_ID",
    "MAPBOX_TOKEN",
    "OPENAI_API_KEY",
  ]
  const missing = reqd.filter((k) => !process.env[k])
  const optionalMissing = opt.filter((k) => !process.env[k])
  return ok({ missing, optionalMissing })
}
