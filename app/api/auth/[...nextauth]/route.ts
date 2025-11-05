import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
const emailReady =
  !!process.env.EMAIL_SERVER_HOST &&
  !!process.env.EMAIL_SERVER_PORT &&
  !!process.env.EMAIL_SERVER_USER &&
  !!process.env.EMAIL_SERVER_PASSWORD &&
  !!process.env.EMAIL_FROM

const providers =
  AUTH_ENABLED && emailReady
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
    : []

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  // If auth is disabled, don't expose sign-in pages
  ...(AUTH_ENABLED ? {} : { pages: { signIn: "/" } }),
  callbacks: {
    async session({ session }) {
      return session
    },
  },
})

export { handler as GET, handler as POST }
