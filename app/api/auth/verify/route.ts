import type { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { createSession } from "@/lib/jwt"
import { NextResponse } from "next/server"

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = verifySchema.parse(body)

    // Find user
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get latest unconsumed verification code
    const verification = await db.emailVerification.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: "desc" },
    })

    if (!verification) {
      return NextResponse.json(
        { error: "No active verification code. Request a new one." },
        { status: 404 }
      )
    }

    // Expired?
    if (new Date() > verification.expiresAt) {
      return NextResponse.json(
        { error: "Verification code expired. Request a new one." },
        { status: 400 }
      )
    }

    // Validate bcrypt hash
    const valid = await bcrypt.compare(code, verification.code)
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      )
    }

    // Mark user verified
    await db.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    })

    // Mark code consumed
    await db.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    })

    // Create session cookie
    await createSession({
      userId: user.id,
      email: user.email,
      isVerified: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("VERIFY ERROR:", err)

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Verification failed. Try again." },
      { status: 500 }
    )
  }
}
