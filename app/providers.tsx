"use client"
import { SessionProvider } from "next-auth/react"
import type React from "react"

const authEnabled =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
    : ((window as any).__NEXT_PUBLIC_AUTH_ENABLED__ ?? process.env.NEXT_PUBLIC_AUTH_ENABLED === "true")

export default function AppProviders({ children }: { children: React.ReactNode }) {
  if (!authEnabled) return <>{children}</>
  return <SessionProvider>{children}</SessionProvider>
}
