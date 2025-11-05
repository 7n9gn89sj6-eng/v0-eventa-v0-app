import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

// Primary: UPSTASH_KV_REST_API_URL with legacy KV_REST_API_URL fallback
const url = process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL

// Primary: UPSTASH_KV_REST_API_TOKEN with legacy KV_REST_API_TOKEN fallback
const token = process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN

export const limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(10, "10 s"),
      })
    : null
