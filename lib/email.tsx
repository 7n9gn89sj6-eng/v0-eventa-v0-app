import "server-only"
import { Resend } from "resend"

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.error("[v0] RESEND_API_KEY is not configured")
    throw new Error("Email service is not configured. Please set RESEND_API_KEY environment variable.")
  }

  return new Resend(apiKey)
}

export async function sendVerificationEmail(email: string, code: string) {
  try {
    const resend = getResendClient()
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev"

    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject: "Verify your email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    })

    if (error) {
      console.error("[v0] Resend API error:", error)
      throw new Error(`Failed to send verification email: ${error.message}`)
    }

    console.log("[v0] Verification email sent successfully to:", email, "ID:", data?.id)
  } catch (error) {
    console.error("[v0] Error sending verification email:", error)
    throw error instanceof Error ? error : new Error("Failed to send verification email")
  }
}

export async function sendEventEditLinkEmail(to: string, eventTitle: string, eventId: string, token: string) {
  try {
    const resend = getResendClient()
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const editLink = `${appUrl}/event/confirm?token=${token}`

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Confirm your event: ${eventTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Event Has Been Created!</h2>
          <p>Your event "<strong>${eventTitle}</strong>" has been submitted successfully!</p>
          <p>Click the button below to confirm and finalize your event:</p>
          <div style="margin: 30px 0;">
            <a href="${editLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Confirm & Finalize Event
            </a>
          </div>
          <p>Or copy this link:</p>
          <p style="background-color: #f4f4f4; padding: 10px; word-break: break-all; font-size: 12px;">
            ${editLink}
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            <strong>Important:</strong> This link will allow you to edit your event for 30 days. Keep it safe - anyone with this link can modify your event.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error("[v0] Resend API error:", error)
      throw new Error(`Failed to send edit link email: ${error.message}`)
    }

    console.log("[v0] Edit link email sent successfully to:", to, "ID:", data?.id)
  } catch (error) {
    console.error("[v0] Error sending edit link email:", error)
    throw error instanceof Error ? error : new Error("Failed to send edit link email")
  }
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  try {
    const resend = getResendClient()
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev"

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })

    if (error) {
      console.error("[v0] Resend API error:", error)
      throw new Error(`Failed to send email: ${error.message}`)
    }

    console.log("[v0] Email sent successfully to:", to, "subject:", subject, "ID:", data?.id)
  } catch (error) {
    console.error("[v0] Error sending email:", error)
    throw error instanceof Error ? error : new Error("Failed to send email")
  }
}
