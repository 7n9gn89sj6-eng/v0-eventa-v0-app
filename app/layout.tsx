import type React from "react"
import "./globals.css"
import AppProviders from "./providers"
import { VersionDisplay } from "@/components/version-display"
import { SiteHeader } from "@/components/layout/site-header"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <SiteHeader />
          {children}
        </AppProviders>
        <VersionDisplay />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__NEXT_PUBLIC_AUTH_ENABLED__=${JSON.stringify(
              process.env.NEXT_PUBLIC_AUTH_ENABLED === "true",
            )};`,
          }}
        />
      </body>
    </html>
  )
}

export const metadata = {
  generator: "v0.app",
}
