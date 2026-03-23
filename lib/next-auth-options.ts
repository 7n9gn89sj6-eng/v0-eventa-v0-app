// TEMP DISABLED (Render startup isolation): re-enable admin credentials by uncommenting crypto + CredentialsProvider imports and the block below through providers.push.
// import crypto from "crypto"
import type { NextAuthOptions } from "next-auth"
// import CredentialsProvider from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/email"
import { adminCredentialsConfigured } from "@/lib/admin-credentials-config"
import { sendEmailAPI } from "@/lib/email"

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"

const emailReady =
  !!process.env.EMAIL_SERVER_HOST &&
  !!process.env.EMAIL_SERVER_PORT &&
  !!process.env.EMAIL_SERVER_USER &&
  !!process.env.EMAIL_SERVER_PASSWORD &&
  !!process.env.EMAIL_FROM

/*
function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function buildCredentialsProvider() {
  return CredentialsProvider({
    id: "credentials",
    name: "Admin",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
      const adminPassword = process.env.ADMIN_PASSWORD ?? ""
      if (!adminEmail || !adminPassword) return null

      const email = credentials?.email?.trim().toLowerCase() ?? ""
      const password = credentials?.password ?? ""
      if (!email || !password) return null
      if (email !== adminEmail || !timingSafeEqualString(password, adminPassword)) return null

      return {
        id: "admin",
        email: process.env.ADMIN_EMAIL!.trim(),
        name: "Admin",
        role: "admin" as const,
      }
    },
  })
}
*/

function buildEmailProvider() {
  return EmailProvider({
    server: {
      host: process.env.EMAIL_SERVER_HOST!,
      port: Number(process.env.EMAIL_SERVER_PORT!),
      auth: {
        user: process.env.EMAIL_SERVER_USER!,
        pass: process.env.EMAIL_SERVER_PASSWORD!,
      },
    },
    from: process.env.EMAIL_FROM!,
    sendVerificationRequest: async ({ identifier: email, url }) => {
      const html = `
          <div style="font-family:Arial;max-width:600px;margin:auto;">
            <h2>Sign in to Eventa</h2>
            <p>Click the button below to sign in:</p>
            <p style="margin:24px 0;">
              <a href="${url}"
                style="background:#6366F1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
                Sign In
              </a>
            </p>
            <p>If the button doesn't work, copy this URL:</p>
            <p style="word-break:break-all;">${url}</p>
            <p style="font-size:12px;color:#666;margin-top:32px;">
              This link expires in 24 hours.
            </p>
          </div>
        `

      const result = await sendEmailAPI({
        to: email,
        subject: "Sign in to Eventa",
        html,
      })
      if (!result.success) {
        throw new Error(result.error ?? "Failed to send magic link email")
      }
    },
  })
}

const providers: NextAuthOptions["providers"] = []
if (AUTH_ENABLED && emailReady) {
  providers.push(buildEmailProvider())
}
// TEMP DISABLED (Render): admin Credentials provider — uncomment imports + block above + this push to restore ADMIN_EMAIL / ADMIN_PASSWORD login.
// if (adminCredentialsConfigured) {
//   providers.push(buildCredentialsProvider())
// }

const useCustomSignInPage = AUTH_ENABLED || adminCredentialsConfigured

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  session: { strategy: "jwt" },
  pages: useCustomSignInPage
    ? {
        signIn: "/auth/signin",
        error: "/auth/error",
      }
    : {
        signIn: "/",
      },
  callbacks: {
    async signIn({ user, account }) {
      if (user?.email && account?.provider !== "credentials") {
        const { db } = await import("@/lib/db")
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        })
        if (dbUser) {
          const { createSession } = await import("@/lib/jwt")
          await createSession(dbUser.id)
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.role = user.role === "admin" ? "admin" : undefined
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub
        session.user.role = token.role === "admin" ? "admin" : undefined
      }
      return session
    },
  },
}

export { adminCredentialsConfigured }
