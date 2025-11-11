import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    console.log("[v0] Testing email configuration...")
    console.log("[v0] EMAIL_FROM:", process.env.EMAIL_FROM)
    console.log("[v0] EMAIL_SERVER_HOST:", process.env.EMAIL_SERVER_HOST)
    console.log("[v0] EMAIL_SERVER_PORT:", process.env.EMAIL_SERVER_PORT)
    console.log("[v0] EMAIL_SERVER_USER:", process.env.EMAIL_SERVER_USER ? "SET" : "NOT SET")
    console.log("[v0] EMAIL_SERVER_PASSWORD:", process.env.EMAIL_SERVER_PASSWORD ? "SET" : "NOT SET")

    const { sendVerificationEmail } = await import("@/lib/email")

    console.log("[v0] Attempting to send test email...")
    await sendVerificationEmail("test@example.com", "test-event-id", "Test Event")

    console.log("[v0] Test email sent successfully!")

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully! Check Mailtrap inbox.",
      config: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        from: process.env.EMAIL_FROM,
        userConfigured: !!process.env.EMAIL_SERVER_USER,
        passwordConfigured: !!process.env.EMAIL_SERVER_PASSWORD,
      },
    })
  } catch (error: any) {
    console.error("[v0] Test email error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}
