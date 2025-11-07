import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { to } = body

    if (!to) {
      return NextResponse.json({ error: "Missing 'to' email address" }, { status: 400 })
    }

    console.log("[v0] Email test: Sending test email to:", to)

    await sendEmail({
      to,
      subject: "Eventa Email Test",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">✓ Email Test Successful</h2>
          <p>This is a test email from Eventa to verify your email configuration is working correctly.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      `,
    })

    console.log("[v0] Email test: ✓ Test email sent successfully")

    return NextResponse.json({
      ok: true,
      message: "Test email sent successfully",
      sentTo: to,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Email test: ✗ Failed to send test email:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send test email",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Email test endpoint. Use POST with { to: 'email@example.com' }",
    env: {
      EMAIL_SERVER_HOST: !!process.env.EMAIL_SERVER_HOST,
      EMAIL_SERVER_PORT: !!process.env.EMAIL_SERVER_PORT,
      EMAIL_SERVER_USER: !!process.env.EMAIL_SERVER_USER,
      EMAIL_SERVER_PASSWORD: !!process.env.EMAIL_SERVER_PASSWORD,
      EMAIL_FROM: process.env.EMAIL_FROM,
    },
  })
}
