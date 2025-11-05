import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/email"
import { createSearchTextFolded } from "@/lib/search/accent-fold"
import { createEventEditToken } from "@/lib/eventEditToken"
import { sendEventEditLinkEmail } from "@/lib/email"

const submitEventSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  humanCheck: z
    .string()
    .toLowerCase()
    .refine((val) => val === "communities", {
      message: "Human check failed",
    }),
  title: z.string().min(5),
  description: z.string().min(20),
  address: z.string().min(5),
  city: z.string().min(2),
  country: z.string().min(2),
  startAt: z.string(),
  endAt: z.string(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  externalUrl: z.string().url().optional().or(z.literal("")),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("[v0] Received event submission:", body)

    const validatedData = submitEventSchema.parse(body)

    let user
    try {
      user = await db.user.findUnique({
        where: { email: validatedData.email },
      })
    } catch (dbError) {
      console.error("[v0] Database error - tables may not exist:", dbError)
      return NextResponse.json(
        {
          error: "Database not initialized. Please run the setup script first.",
        },
        { status: 500 },
      )
    }

    if (!user) {
      user = await db.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          isVerified: false,
        },
      })
    } else if (validatedData.name && !user.name) {
      user = await db.user.update({
        where: { id: user.id },
        data: { name: validatedData.name },
      })
    }

    const searchParts = [
      validatedData.title,
      validatedData.description,
      validatedData.address,
      validatedData.city,
      validatedData.country,
    ]
    const searchText = searchParts.filter(Boolean).join(" ")
    const searchTextFolded = createSearchTextFolded(searchParts)

    const event = await db.event.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        locationAddress: validatedData.address,
        city: validatedData.city,
        country: validatedData.country,
        startAt: new Date(validatedData.startAt),
        endAt: new Date(validatedData.endAt),
        imageUrl: validatedData.imageUrl || null,
        externalUrl: validatedData.externalUrl || null,
        createdById: user.id,
        status: "DRAFT",
        searchText,
        searchTextFolded,
        categories: [],
        languages: ["en"],
        imageUrls: validatedData.imageUrl ? [validatedData.imageUrl] : [],
      },
    })

    console.log("[v0] Event created successfully:", event.id)

    let emailedEditLink = false
    try {
      console.log(`[v0] Attempting to send edit link email to ${validatedData.email}`)
      const token = await createEventEditToken(event.id, event.endAt)
      console.log(`[v0] Edit token created: ${token.substring(0, 10)}...`)
      await sendEventEditLinkEmail(validatedData.email, event.title, event.id, token)
      emailedEditLink = true
      console.log(`[v0] ✓ Edit link email sent successfully to ${validatedData.email}`)
    } catch (emailError) {
      console.error("[v0] ✗ Failed to send edit link email:", emailError)
      console.error("[v0] Error details:", emailError instanceof Error ? emailError.message : String(emailError))
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const hashedCode = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000)

    console.log(`[v0] Creating email verification record for user ${user.id}`)
    await db.emailVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        code: hashedCode,
        expiresAt,
      },
    })
    console.log(`[v0] ✓ Email verification record created`)

    try {
      console.log(`[v0] Attempting to send verification email to ${user.email}`)
      console.log(`[v0] Verification code: ${code}`)
      await sendVerificationEmail(user.email, code)
      console.log(`[v0] ✓ Verification email sent successfully to ${user.email}`)
    } catch (emailError) {
      console.error("[v0] ✗ Failed to send verification email:", emailError)
      console.error("[v0] Error details:", emailError instanceof Error ? emailError.message : String(emailError))
      console.log("[v0] Verification code for manual use:", code)
    }

    return NextResponse.json({ ok: true, emailedEditLink })
  } catch (error) {
    console.error("[v0] Error submitting event:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to submit event. Please try again.",
      },
      { status: 500 },
    )
  }
}
