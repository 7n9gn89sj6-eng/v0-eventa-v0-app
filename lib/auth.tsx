import "server-only"
import NextAuth, { type NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { adapter, adapterReady } from "@/lib/adapter"
import { sendEmail } from "@/lib/email"

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        console.log("[v0] NextAuth sending magic link to:", email)
        console.log("[v0] Magic link URL:", url)

        try {
          const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sign in to Eventa</title>
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Eventa</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Sign in to your account</p>
                </div>
                
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 16px; margin-bottom: 20px;">Click the button below to sign in to Eventa:</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign in to Eventa</a>
                  </div>
                  
                  <div style="background: #f9fafb; border-radius: 8px; padding: 15px; margin: 25px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">If the button doesn't work, you can copy and paste this URL into your browser:</p>
                    <p style="margin: 0; font-size: 13px; word-break: break-all; color: #667eea;">${url}</p>
                  </div>
                  
                  <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    This link will expire in 24 hours. If you didn't request this email, you can safely ignore it.
                  </p>
                </div>
                
                <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
                  <p>© ${new Date().getFullYear()} Eventa. All rights reserved.</p>
                </div>
              </body>
            </html>
          `

          await sendEmail({
            to: email,
            subject: "Sign in to Eventa",
            html,
          })

          console.log("[v0] ✓ Magic link email sent successfully to:", email)
        } catch (error) {
          console.error("[v0] ✗ Failed to send magic link email:", error)
          throw error
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as auth, adapterReady }
export default handler
