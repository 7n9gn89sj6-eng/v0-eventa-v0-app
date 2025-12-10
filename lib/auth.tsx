import "server-only";
import NextAuth, { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";

import { adapter, adapterReady } from "@/lib/adapter";
import { sendEmailAPI } from "@/lib/email";  // ✅ Correct import

export const authOptions: NextAuthOptions = {
  adapter,

  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,

      sendVerificationRequest: async ({ identifier: email, url }) => {
        console.log("[auth] Sending magic link to:", email);

        const html = `
          <div style="font-family:Arial;max-width:600px;margin:auto;">
            <h2>Sign in to Eventa</h2>
            <p>Click the button below to sign in:</p>

            <p style="margin:24px 0;">
              <a href="${url}" 
                style="background:#6366F1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
                Sign in
              </a>
            </p>

            <p>If the button doesn’t work, copy this link:</p>
            <p style="word-break:break-all;">${url}</p>

            <p style="font-size:12px;color:#666;margin-top:32px;">
              This link expires in 24 hours.
            </p>
          </div>
        `;

        const result = await sendEmailAPI({
          to: email,
          subject: "Sign in to Eventa",
          html,
        });

        if (!result.success) {
          console.error("[auth] Email failed:", result.error);
          throw new Error(`Failed to send verification email: ${result.error}`);
        }

        console.log("[auth] Magic link sent successfully");
      },
    }),
  ],

  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },

  session: { strategy: "jwt" },

  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as auth, adapterReady };
export default handler;
