import type { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./db"
import { isAuthConfigured } from "./auth-config"

if (!isAuthConfigured) {
  console.warn("[NextAuth] Email provider not configured. Authentication is disabled.")
  console.warn("[NextAuth] Set EMAIL_SERVER_* environment variables to enable authentication.")
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    async redirect({ url, baseUrl }) {
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
          return baseUrl + "/add-event"
        }
        return baseUrl + url
      }
      // Absolute URLs: allow same-origin, else fall back
      try {
        const u = new URL(url)
        if (u.origin === baseUrl) {
          if (u.pathname === "/") return baseUrl + "/add-event"
          return u.toString()
        }
      } catch {}
      return baseUrl + "/add-event"
    },
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === "development",
}

export { isAuthConfigured }
