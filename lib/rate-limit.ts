import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Create rate limiter for API endpoints
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  prefix: "@upstash/ratelimit",
})

// More restrictive rate limit for expensive operations
export const strictRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "@upstash/ratelimit/strict",
})
