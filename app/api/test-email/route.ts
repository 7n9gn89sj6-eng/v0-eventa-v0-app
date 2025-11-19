import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
   const testEmail =
  searchParams.get("email") || "7n9gn89sj6@privaterelay.appleid.com"
    console.log("[v0] Testing Resend SMTP configuration...")
    console.log("[v0] EMAIL_FROM:", process.env.EMAIL_FROM)
    console.log("[v0] EMAIL_SERVER_HOST:", process.env.EMAIL_SERVER_HOST)
    console.log("[v0] EMAIL_SERVER_PORT:", process.env.EMAIL_SERVER_PORT)
    console.log("[v0] EMAIL_SERVER_USER:", process.env.EMAIL_SERVER_USER ? "SET" : "NOT SET")
    console.log("[v0] EMAIL_SERVER_PASSWORD:", process.env.EMAIL_SERVER_PASSWORD ? "SET" : "NOT SET")

    const { sendEmail } = await import("@/lib/email")

    console.log(`[v0] Attempting to send test email to ${testEmail}...`)
    
    const result = await sendEmail({
      to: testEmail,
      subject: "Eventa - Test Email from Resend SMTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Email Configuration Test</h2>
          <p>This is a test email sent from your Eventa application using Resend SMTP.</p>
          
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>SMTP Host:</strong> ${process.env.EMAIL_SERVER_HOST}</p>
            <p style="margin: 5px 0;"><strong>SMTP Port:</strong> ${process.env.EMAIL_SERVER_PORT}</p>
            <p style="margin: 5px 0;"><strong>From Address:</strong> ${process.env.EMAIL_FROM}</p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you received this email, your production email configuration is working correctly!
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Sent from Eventa Event Platform
          </p>
        </div>
      `,
    })

    if (result.success) {
      console.log("[v0] Test email sent successfully via Resend!")

      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}! Check your inbox.`,
        messageId: result.messageId,
        config: {
          host: process.env.EMAIL_SERVER_HOST,
          port: process.env.EMAIL_SERVER_PORT,
          from: process.env.EMAIL_FROM,
          userConfigured: !!process.env.EMAIL_SERVER_USER,
          passwordConfigured: !!process.env.EMAIL_SERVER_PASSWORD,
          smtpProvider: "Resend",
        },
      })
    } else {
      throw new Error(result.error)
    }
  } catch (error: any) {
    console.error("[v0] Test email error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to send test email",
        details: "Check server logs for more information",
        config: {
          host: process.env.EMAIL_SERVER_HOST,
          port: process.env.EMAIL_SERVER_PORT,
          from: process.env.EMAIL_FROM,
        },
      },
      { status: 500 },
    )
  }
}
