import type { NextAuthOptions } from "next-auth"
// Temporarily disable Email auth to avoid warnings
// import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./db"
// import { isAuthConfigured } from "./auth-config"

// Remove noisy console warnings in dev
// if (!isAuthConfigured) {
//   console.warn("[NextAuth] Email provider not configured. Authentication is disabled.")
//   console.warn("[NextAuth] Set EMAIL_SERVER_* environment variables to enable authentication.")
// }

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,

  // No providers for now (keeps app running without SMTP)
  providers: [],

  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },

  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        // @ts-expect-error – your user model adds id onto session.user
        session.user.id = user.id
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
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

  // Force debug off in dev unless you explicitly enable it via env
  debug: process.env.NEXTAUTH_DEBUG === "true",
}

export { /* isAuthConfigured */ }
