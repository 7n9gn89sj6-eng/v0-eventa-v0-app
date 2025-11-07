import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import "server-only"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-change-in-production"
const JWT_COOKIE_NAME = "eventa-session"

export interface SessionPayload {
  userId: string
  email: string
  isVerified: boolean
  isAdmin?: boolean
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  })

  const cookieStore = await cookies()
  cookieStore.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  })

  return token
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(JWT_COOKIE_NAME)?.value

    if (!token) {
      return null
    }

    const payload = jwt.verify(token, JWT_SECRET) as SessionPayload
    return payload
  } catch (error) {
    console.error("[v0] JWT verification failed:", error)
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(JWT_COOKIE_NAME)
}
