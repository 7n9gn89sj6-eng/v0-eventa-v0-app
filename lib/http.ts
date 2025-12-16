import { NextResponse } from "next/server"

/**
 * Standard success response helper
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/**
 * Alias for ok() - for backward compatibility
 */
export const jsonOk = ok

/**
 * Standard error response helper
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @param meta - Additional metadata to include in error response
 */
export function fail(message: string, status = 400, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...meta }, { status })
}

/**
 * Alias for fail() with metadata support - for backward compatibility
 */
export function jsonError(message: string, status = 400, meta?: Record<string, unknown>): NextResponse {
  return fail(message, status, meta)
}

/**
 * Validation error response helper with details
 * @param message - Error message
 * @param details - Validation error details
 */
export function validationError(message: string, details: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

/**
 * Fetch with automatic timeout and labeled errors
 * @param input - URL or Request object
 * @param init - RequestInit options with optional timeoutMs (default: 8000ms)
 * @throws Error with "__label:UPSTREAM_TIMEOUT" on timeout
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 8000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (err: any) {
    clearTimeout(timeoutId)

    // Check if the error was caused by abort (timeout)
    if (err?.name === "AbortError") {
      const timeoutError = new Error("__label:UPSTREAM_TIMEOUT")
      throw timeoutError
    }

    // Re-throw other fetch errors as-is
    throw err
  }
}
