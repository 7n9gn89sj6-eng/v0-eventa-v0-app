import type { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { isAuthConfigured } from "./auth-config"
import { getServerSession } from "next-auth"

let PrismaAdapter: any
let prisma: any

if (!isAuthConfigured) {
  console.warn("[NextAuth] Email provider not configured. Authentication is disabled.")
  console.warn("[NextAuth] Set NEXT_PUBLIC_AUTH_ENABLED=true to enable authentication.")
}

export const authOptions: NextAuthOptions = {
  providers: isAuthConfigured
    ? [
        EmailProvider({
          server: {
            host: process.env.EMAIL_SERVER_HOST!,
            port: Number(process.env.EMAIL_SERVER_PORT!),
            auth: {
              user: process.env.EMAIL_SERVER_USER!,
              pass: process.env.EMAIL_SERVER_PASSWORD!,
            },
          },
          from: process.env.EMAIL_FROM!,
        }),
      ]
    : [],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  callbacks: {
    async session({ session, user, token }) {
      if (session.user && token?.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      const debugEnabled = process.env.DEBUG_AUTH_REDIRECTS === "1"

      // If already on /add-event with ?from=auth, don't redirect again
      try {
        const urlObj = new URL(url, baseUrl)
        if (urlObj.pathname === "/add-event" && urlObj.searchParams.has("from")) {
          const finalUrl = url.startsWith("/") ? baseUrl + url : url
          if (debugEnabled) {
            console.log("[Auth Redirect] Loop prevention: from=%s to=%s", url, finalUrl)
          }
          return finalUrl
        }
      } catch {
        // Invalid URL, continue with normal logic
      }

      // Allow intended relative paths
      if (url.startsWith("/")) {
        // If root or auth pages, send to /add-event
        if (
          url === "/" ||
          url === "/api/auth/signin" ||
          url.startsWith("/api/auth/callback") ||
          url.startsWith("/auth/verify") ||
          url === "/auth/signin"
        ) {
          const finalUrl = baseUrl + "/add-event"
          if (debugEnabled) {
            console.log("[Auth Redirect] Auth page: from=%s to=%s", url, finalUrl)
          }
          return finalUrl
        }
        const finalUrl = baseUrl + url
        if (debugEnabled) {
          console.log("[Auth Redirect] Relative path: from=%s to=%s", url, finalUrl)
        }
        return finalUrl
      }
      // Absolute URLs: allow same-origin, else fall back
      try {
        const u = new URL(url)
        if (u.origin === baseUrl) {
          if (u.pathname === "/") {
            const finalUrl = baseUrl + "/add-event"
            if (debugEnabled) {
              console.log("[Auth Redirect] Root absolute: from=%s to=%s", url, finalUrl)
            }
            return finalUrl
          }
          if (debugEnabled) {
            console.log("[Auth Redirect] Same origin: from=%s to=%s", url, u.toString())
          }
          return u.toString()
        }
      } catch {}
      const finalUrl = baseUrl + "/add-event"
      if (debugEnabled) {
        console.log("[Auth Redirect] Fallback: from=%s to=%s", url, finalUrl)
      }
      return finalUrl
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === "development",
}

export const auth = () => getServerSession(authOptions)

export { isAuthConfigured }
