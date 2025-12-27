"use client"
import { SessionProvider } from "next-auth/react"
import type React from "react"
import { I18nProvider } from "@/lib/i18n/context"
import { LocationProvider } from "@/lib/location-context"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const authEnabled =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
    : ((window as any).__NEXT_PUBLIC_AUTH_ENABLED__ ?? process.env.NEXT_PUBLIC_AUTH_ENABLED === "true")

const isProd =
  typeof window !== "undefined"
    ? (window as any).__NEXT_PUBLIC_VERCEL_ENV__ === "production"
    : process.env.NEXT_PUBLIC_VERCEL_ENV === "production"

export default function AppProviders({ children }: { children: React.ReactNode }) {
  if (!authEnabled) {
    return (
      <I18nProvider>
        <LocationProvider>
          {children}
          {isProd && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
        </LocationProvider>
      </I18nProvider>
    )
  }
  return (
    <SessionProvider>
      <I18nProvider>
        <LocationProvider>
          {children}
          {isProd && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
        </LocationProvider>
      </I18nProvider>
    </SessionProvider>
  )
}
