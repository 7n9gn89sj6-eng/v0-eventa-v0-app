import "server-only"
import NextAuth from "next-auth"
import { authOptions } from "@/lib/next-auth-options"
import { adapterReady } from "@/lib/adapter"

const handler = NextAuth(authOptions)

export { handler as auth, authOptions, adapterReady }
