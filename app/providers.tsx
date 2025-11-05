"use client"
import { SessionProvider } from "next-auth/react"
import type React from "react"
import { I18nProvider } from "@/lib/i18n/context"

const authEnabled =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
    : ((window as any).__NEXT_PUBLIC_AUTH_ENABLED__ ?? process.env.NEXT_PUBLIC_AUTH_ENABLED === "true")

export default function AppProviders({ children }: { children: React.ReactNode }) {
  if (!authEnabled) {
    return <I18nProvider>{children}</I18nProvider>
  }
  return (
    <SessionProvider>
      <I18nProvider>{children}</I18nProvider>
    </SessionProvider>
  )
}
