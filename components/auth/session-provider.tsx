"use client"

import type React from "react"
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { useEffect, useState } from "react"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    // Check if auth endpoint is accessible
    fetch("/api/auth/session")
      .then((res) => {
        if (!res.ok) {
          console.warn("[Auth] Session endpoint not available, auth disabled")
          setHasError(true)
        }
      })
      .catch(() => {
        console.warn("[Auth] Failed to connect to auth, running without authentication")
        setHasError(true)
      })
  }, [])

  // If auth has errors, just render children without SessionProvider
  if (hasError) {
    return <>{children}</>
  }

  return (
    <NextAuthSessionProvider
      // Refetch session less frequently to reduce errors when auth is not configured
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </NextAuthSessionProvider>
  )
}
