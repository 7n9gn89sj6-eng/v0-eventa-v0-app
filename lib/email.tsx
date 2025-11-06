import nodemailer from "nodemailer"

let transporter: nodemailer.Transporter | null = null
let initError: string | null = null

try {
  const isEmailConfigured = !!(
    process.env.EMAIL_SERVER_HOST?.trim() &&
    process.env.EMAIL_SERVER_PORT?.trim() &&
    process.env.EMAIL_SERVER_USER?.trim() &&
    process.env.EMAIL_SERVER_PASSWORD?.trim() &&
    process.env.EMAIL_FROM?.trim()
  )

  if (isEmailConfigured) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })
    console.log("[v0] Email transporter initialized")
  } else {
    initError = "Email environment variables not configured"
    console.log("[v0] Email not configured - missing environment variables")
  }
} catch (error) {
  initError = error instanceof Error ? error.message : "Failed to initialize email"
  console.error("[v0] Email initialization error:", error)
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

export async function sendVerificationEmail(email: string, code: string) {
  console.log("[v0] Attempting to send verification email to:", email)

  if (!transporter) {
    const errorMsg = initError || "Email system not configured"
    console.error("[v0] Cannot send email:", errorMsg)
    throw new Error(errorMsg)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const magicLink = `${appUrl}/verify?email=${encodeURIComponent(email)}&code=${code}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Event Submission</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Eventa</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Verify Your Event Submission</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Thank you for submitting your event! To publish it, please verify your email address.</p>
          
          <div style="background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Your verification code:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #667eea;">${code}</p>
          </div>
          
          <p style="text-align: center; margin: 25px 0;">Or click the button below to verify automatically:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email</a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            This code will expire in 20 minutes. If you didn't submit an event, you can safely ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Eventa. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
Verify Your Event Submission

Thank you for submitting your event! To publish it, please verify your email address.

Your verification code: ${code}

Or visit this link to verify automatically:
${magicLink}

This code will expire in 20 minutes. If you didn't submit an event, you can safely ignore this email.

© ${new Date().getFullYear()} Eventa. All rights reserved.
  `.trim()

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Verify Your Event Submission - Eventa",
      text,
      html,
    })
    console.log("[v0] ✓ Verification email sent successfully to:", email)
  } catch (error) {
    console.error("[v0] ✗ Failed to send verification email:", error)
    throw new Error("Failed to send verification email")
  }
}

export async function sendEventEditLinkEmail(to: string, eventTitle: string, eventId: string, token: string) {
  console.log("[v0] Attempting to send edit link email to:", to)

  if (!transporter) {
    const errorMsg = initError || "Email system not configured"
    console.error("[v0] Cannot send email:", errorMsg)
    throw new Error(errorMsg)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const editUrl = `${baseUrl}/event/confirm?token=${encodeURIComponent(token)}`
  const subject = `Finalize Your Event: ${escapeHtml(eventTitle)}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Finalize Your Event Submission</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Eventa</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Finalize Your Event Submission</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Thank you for submitting your event titled <strong>${escapeHtml(eventTitle)}</strong>! To finalize your event, we require you to confirm the details.</p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">Please click the link below to review and confirm your event submission:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${editUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Finalize Your Event Submission</a>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 20px;">For security purposes, this link will expire in 30 days. After confirmation, you can still use this link to <strong>edit</strong> your event details any time in the future without needing to log in.</p>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">If the button doesn't work, you can copy and paste this URL into your browser:</p>
            <p style="margin: 0; font-size: 13px; word-break: break-all; color: #667eea;">${editUrl}</p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            This link will expire in 30 days from now. Keep it safe for any future updates to your event.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Eventa. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
Finalize Your Event Submission

Thank you for submitting your event titled "${eventTitle}"! To finalize your event, we require you to confirm the details.

Please click the link below to review and confirm your event submission:
${editUrl}

For security purposes, this link will expire in 30 days. After confirmation, you can still use this link to edit your event details any time in the future without needing to log in.

This link will expire in 30 days from now. Keep it safe for any future updates to your event.

© ${new Date().getFullYear()} Eventa. All rights reserved.
  `.trim()

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    })
    console.log("[v0] ✓ Edit link email sent successfully to:", to)
  } catch (error) {
    console.error("[v0] ✗ Failed to send edit link email:", error)
    throw new Error("Failed to send edit link email")
  }
}
