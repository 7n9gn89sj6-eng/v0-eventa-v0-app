export const runtime = "nodejs"

import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { env } from "@/lib/env"

export async function GET() {
  try {
    const transporter = nodemailer.createTransport({
      host: env.EMAIL_SERVER_HOST,
      port: Number.parseInt(env.EMAIL_SERVER_PORT, 10),
      auth: {
        user: env.EMAIL_SERVER_USER,
        pass: env.EMAIL_SERVER_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: env.EMAIL_FROM, // Send to same address for testing
      subject: "Eventa Email Test",
      text: "This is a test email from Eventa. If you received this, your Mailtrap configuration is working correctly!",
      html: "<p>This is a test email from <strong>Eventa</strong>.</p><p>If you received this, your Mailtrap configuration is working correctly!</p>",
    })

    return NextResponse.json({
      ok: true,
      message: "Test email sent successfully to Mailtrap",
      config: {
        host: env.EMAIL_SERVER_HOST,
        port: env.EMAIL_SERVER_PORT,
        from: env.EMAIL_FROM,
      },
    })
  } catch (error) {
    console.error("Email test failed:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send test email",
      },
      { status: 500 },
    )
  }
}
