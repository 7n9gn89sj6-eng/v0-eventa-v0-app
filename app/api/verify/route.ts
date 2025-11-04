import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { createSession } from "@/lib/jwt"

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = verifySchema.parse(body)

    // Find the user
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Find the latest non-consumed verification for this email
    const verification = await db.emailVerification.findFirst({
      where: {
        email,
        consumedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    if (!verification) {
      return NextResponse.json({ error: "No verification code found. Please request a new one." }, { status: 404 })
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 })
    }

    // Verify the code
    const isValid = await bcrypt.compare(code, verification.code)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
    }

    // Mark user as verified
    await db.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    })

    // Mark verification as consumed
    await db.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    })

    // Create JWT session
    await createSession({
      userId: user.id,
      email: user.email,
      isVerified: true,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[v0] Verification error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 })
  }
}
