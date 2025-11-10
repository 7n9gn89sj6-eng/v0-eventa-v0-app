export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import type { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { createSession } from "@/lib/jwt"
import { ok, fail, validationError } from "@/lib/http"

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
      return fail("User not found", 404)
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
      return fail("No verification code found. Please request a new one.", 404)
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      return fail("Verification code has expired. Please request a new one.", 400)
    }

    // Verify the code
    const isValid = await bcrypt.compare(code, verification.code)

    if (!isValid) {
      return fail("Invalid verification code", 400)
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

    return ok({ ok: true })
  } catch (error) {
    console.error("[v0] Verification error:", error)

    if (error instanceof z.ZodError) {
      return validationError("Invalid input", error.errors)
    }

    return fail("Verification failed. Please try again.", 500)
  }
}
