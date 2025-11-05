import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function GET() {
  try {
    console.log("[v0] Testing email configuration...")

    // Check if all required env vars are set
    if (
      !process.env.EMAIL_SERVER_HOST ||
      !process.env.EMAIL_SERVER_PORT ||
      !process.env.EMAIL_SERVER_USER ||
      !process.env.EMAIL_SERVER_PASSWORD
    ) {
      return NextResponse.json({
        success: false,
        error: "Missing email configuration",
        config: {
          host: process.env.EMAIL_SERVER_HOST || "NOT SET",
          port: process.env.EMAIL_SERVER_PORT || "NOT SET",
          user: process.env.EMAIL_SERVER_USER || "NOT SET",
          password: process.env.EMAIL_SERVER_PASSWORD ? "SET" : "NOT SET",
          from: process.env.EMAIL_FROM || "NOT SET",
        },
      })
    }

    const port = Number(process.env.EMAIL_SERVER_PORT)
    if (isNaN(port)) {
      return NextResponse.json({
        success: false,
        error: `Invalid port number: ${process.env.EMAIL_SERVER_PORT}`,
      })
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port,
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })

    console.log("[v0] Transporter created, verifying connection...")

    // Verify connection
    await transporter.verify()
    console.log("[v0] ✓ SMTP connection verified!")

    // Try to send a test email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || "test@eventa.test",
      to: "test@example.com",
      subject: "Test Email from Eventa",
      text: "This is a test email to verify SMTP configuration.",
      html: "<p>This is a test email to verify SMTP configuration.</p>",
    })

    console.log("[v0] ✓ Test email sent!", info)

    return NextResponse.json({
      success: true,
      message: "Email configuration is working! Check your Mailtrap inbox.",
      messageId: info.messageId,
      config: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        user: process.env.EMAIL_SERVER_USER,
      },
    })
  } catch (error: unknown) {
    console.error("[v0] ✗ Email test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: String(error),
        config: {
          host: process.env.EMAIL_SERVER_HOST,
          port: process.env.EMAIL_SERVER_PORT,
          user: process.env.EMAIL_SERVER_USER,
        },
      },
      { status: 500 },
    )
  }
}
