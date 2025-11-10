import "server-only"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import type { Adapter } from "next-auth/adapters"

const noopAdapter: Adapter = {
  createUser: async () => ({ id: "", email: "", emailVerified: null }),
  getUser: async () => null,
  getUserByEmail: async () => null,
  getUserByAccount: async () => null,
  updateUser: async (user) => user,
  deleteUser: async () => {},
  linkAccount: async () => {},
  unlinkAccount: async () => {},
  createSession: async () => ({ sessionToken: "", userId: "", expires: new Date() }),
  getSessionAndUser: async () => null,
  updateSession: async (session) => session,
  deleteSession: async () => {},
  createVerificationToken: async () => ({ identifier: "", token: "", expires: new Date() }),
  useVerificationToken: async () => null,
}

let adapter: Adapter
let adapterReady = false

try {
  adapter = PrismaAdapter(db) as Adapter
  adapterReady = true
  console.log("[v0] Adapter initialized successfully")
} catch (err: any) {
  console.error(
    JSON.stringify({
      level: "error",
      label: "ADAPTER_INIT_FAIL",
      message: err?.message || "Unknown adapter initialization error",
      stack: err?.stack,
    }),
  )
  adapter = noopAdapter
  adapterReady = false
}

export { adapter, adapterReady }
