/**
 * Rate limiting utility using Upstash Redis
 * Provides rate limiting for API endpoints
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Initialize Redis client if UPSTASH_REDIS_REST_URL is available
let ratelimit: Ratelimit | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  // Create rate limiter instances for different endpoints
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds default
    analytics: true,
    prefix: "@upstash/ratelimit",
  })
}

export interface RateLimitConfig {
  requests: number
  window: string // e.g., "10 s", "1 m", "1 h"
}

// Predefined rate limiters for different endpoint types
export const rateLimiters = {
  // Public search endpoints - more lenient
  search: ratelimit
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        }),
        limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 requests per minute
        analytics: true,
        prefix: "@upstash/ratelimit/search",
      })
    : null,

  // Event submission - moderate
  submit: ratelimit
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        }),
        limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 requests per minute
        analytics: true,
        prefix: "@upstash/ratelimit/submit",
      })
    : null,

  // General API - default
  api: ratelimit
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        }),
        limiter: Ratelimit.slidingWindow(20, "1 m"), // 20 requests per minute
        analytics: true,
        prefix: "@upstash/ratelimit/api",
      })
    : null,
}

/**
 * Check rate limit for a given identifier (IP address, user ID, etc.)
 * Returns { success: true } if allowed, { success: false, ... } if rate limited
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit | null = rateLimiters.api
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  // If rate limiting is not configured, allow all requests
  if (!limiter) {
    return { success: true }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // If rate limiting fails, log error but allow request (fail open)
    console.error("[rate-limit] Error checking rate limit:", error)
    return { success: true }
  }
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip") // Cloudflare

  const ip = forwarded?.split(",")[0]?.trim() || realIp || cfConnectingIp || "unknown"

  return ip
}
