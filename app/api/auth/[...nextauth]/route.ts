// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { sendEmailAPI } from "@/lib/email"; // ⬅️ changed

export const runtime = "nodejs";

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
const emailReady =
  !!process.env.EMAIL_SERVER_HOST &&
  !!process.env.EMAIL_SERVER_PORT &&
  !!process.env.EMAIL_SERVER_USER &&
  !!process.env.EMAIL_SERVER_PASSWORD &&
  !!process.env.EMAIL_FROM;

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
          sendVerificationRequest: async ({ identifier: email, url }) => {
            console.log("[v0] NextAuth sending magic link to:", email);
            console.log("[v0] Magic link URL:", url);

            const html = `...same HTML as before...`;

            try {
              await sendEmailAPI({
                to: email,
                subject: "Sign in to Eventa",
                html,
              });

              console.log("[v0] ✓ Magic link email sent successfully to:", email);
            } catch (error) {
              console.error("[v0] ✗ Failed to send magic link email:", error);
              throw error;
            }
          },
        }),
      ]
    : [];

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  ...(AUTH_ENABLED ? {} : { pages: { signIn: "/" } }),
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };
