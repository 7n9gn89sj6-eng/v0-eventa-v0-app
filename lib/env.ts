import { z } from "zod"

const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  NEON_DATABASE_URL: z.string().url("NEON_DATABASE_URL must be a valid URL"),

  // Email via Resend (required for sending emails)
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required for email functionality"),
  EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email address").optional(),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),

  // Optional
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv
  }

  try {
    const rawEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
      NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test" | undefined,
    }

    cachedEnv = envSchema.parse(rawEnv)

    return cachedEnv
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
      throw new Error(`Environment validation failed: ${missingVars}`)
    }
    throw error
  }
}

// Export a convenient env object
export const env = getEnv()

export function assertEnv(keys: string[]): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = []

  for (const key of keys) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing }
  }

  return { ok: true }
}
