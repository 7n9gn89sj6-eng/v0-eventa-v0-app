interface RateLimitEntry {
  count: number
  resetAt: number
}

interface CircuitBreakerEntry {
  failures: number
  lastFailureAt: number
  openUntil: number | null
}

const rateLimits = new Map<string, RateLimitEntry>()
const circuitBreakers = new Map<string, CircuitBreakerEntry>()

const RATE_LIMIT_WINDOW = 10000 // 10 seconds
const MAX_REQUESTS_PER_WINDOW = 3
const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_WINDOW = 60000 // 60 seconds
const CIRCUIT_BREAKER_OPEN_DURATION = 120000 // 2 minutes

export function checkRateLimit(provider: string): { allowed: boolean; reason?: string } {
  const now = Date.now()
  const entry = rateLimits.get(provider)

  if (!entry || now >= entry.resetAt) {
    // Reset or create new entry
    rateLimits.set(provider, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    })
    return { allowed: true }
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, reason: "Rate limit exceeded" }
  }

  entry.count++
  return { allowed: true }
}

export function checkCircuitBreaker(provider: string): { open: boolean; reason?: string } {
  const now = Date.now()
  const breaker = circuitBreakers.get(provider)

  if (!breaker) {
    return { open: false }
  }

  // Check if circuit is open
  if (breaker.openUntil && now < breaker.openUntil) {
    return { open: true, reason: "Circuit breaker open" }
  }

  // Reset if window expired
  if (now - breaker.lastFailureAt > CIRCUIT_BREAKER_WINDOW) {
    circuitBreakers.delete(provider)
    return { open: false }
  }

  return { open: false }
}

export function recordFailure(provider: string) {
  const now = Date.now()
  const breaker = circuitBreakers.get(provider)

  if (!breaker) {
    circuitBreakers.set(provider, {
      failures: 1,
      lastFailureAt: now,
      openUntil: null,
    })
    return
  }

  // Check if within window
  if (now - breaker.lastFailureAt > CIRCUIT_BREAKER_WINDOW) {
    // Reset
    breaker.failures = 1
    breaker.lastFailureAt = now
    breaker.openUntil = null
  } else {
    breaker.failures++
    breaker.lastFailureAt = now

    // Open circuit if threshold reached
    if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      breaker.openUntil = now + CIRCUIT_BREAKER_OPEN_DURATION
      console.log(`[v0] Circuit breaker opened for ${provider} until ${new Date(breaker.openUntil).toISOString()}`)
    }
  }
}

export function recordSuccess(provider: string) {
  // Reset failures on success
  circuitBreakers.delete(provider)
}
