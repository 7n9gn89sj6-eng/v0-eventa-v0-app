"use client"

import type React from "react"

// This allows the app to load without authentication
export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Just render children without any auth wrapper
  // Auth is disabled for v0 preview compatibility
  return <>{children}</>
}
