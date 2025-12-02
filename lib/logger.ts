import { NextResponse } from "next/server"

export type ApiSuccess<T = unknown> = { success: true; data: T; timestamp: string }
export type ApiError = { success: false; error: string; timestamp: string; meta?: Record<string, unknown> }

export function jsonOk<T>(data: T, init?: number | ResponseInit): NextResponse<ApiSuccess<T>> {
  const status = typeof init === "number" ? init : 200
  const responseInit = typeof init === "number" ? { status } : { status: 200, ...init }

  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    responseInit,
  )
}

export function jsonError(message: string, status = 500, meta?: Record<string, unknown>): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      ...(meta && { meta }),
    },
    { status },
  )
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  console.log("[v0]", message, meta || "")
}

export function logError(message: string, meta?: Record<string, unknown>): void {
  console.error("[v0]", message, meta || "")
}
