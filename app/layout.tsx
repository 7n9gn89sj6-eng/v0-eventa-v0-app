import type React from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "../components/ui/toaster"
import { SessionProvider } from "../components/auth/session-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata = {
  title: "Eventa - Discover Community Events",
  description: "Find local events, festivals, markets, and cultural activities in your area",
    generator: 'v0.app'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <SessionProvider>{children}</SessionProvider>
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
