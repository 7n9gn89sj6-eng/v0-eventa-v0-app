export const runtime = "nodejs"

import { z } from "zod"
import nodemailer from "nodemailer"

const EmailBodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const data = EmailBodySchema.parse(await req.json())

    // Check if email is configured
    if (
      !process.env.EMAIL_SERVER_HOST ||
      !process.env.EMAIL_SERVER_PORT ||
      !process.env.EMAIL_SERVER_USER ||
      !process.env.EMAIL_SERVER_PASSWORD
    ) {
      return Response.json(
        { ok: false, error: "Email not configured. Please set EMAIL_SERVER_* environment variables." },
        { status: 500 },
      )
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT || 587),
      secure: Boolean(process.env.SMTP_SECURE === "true"),
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER,
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
    })

    console.log("[v0] ✓ Email sent successfully via API route to:", data.to)

    return Response.json({ ok: true }, { status: 200 })
  } catch (err: any) {
    console.error("[v0] ✗ Email sending failed:", err)

    if (err?.issues) {
      return Response.json({ ok: false, errors: err.issues }, { status: 400 })
    }
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
