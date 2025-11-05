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
 * Standard error response helper
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Validation error response helper with details
 * @param message - Error message
 * @param details - Validation error details
 */
export function validationError(message: string, details: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 })
}
