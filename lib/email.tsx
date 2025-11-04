import nodemailer from "nodemailer"

const isEmailConfigured = !!(
  process.env.EMAIL_SERVER_HOST &&
  process.env.EMAIL_SERVER_PORT &&
  process.env.EMAIL_SERVER_USER &&
  process.env.EMAIL_SERVER_PASSWORD &&
  process.env.EMAIL_FROM
)

let transporter: nodemailer.Transporter | null = null

if (isEmailConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  })
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

  if (!transporter) {
    console.log("[v0] Email not configured. Verification details:")
    console.log("[v0] To:", email)
    console.log("[v0] Code:", code)
    console.log("[v0] Magic Link:", magicLink)
    return
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Verify Your Event Submission - Eventa",
      text,
      html,
    })
    console.log("[v0] Verification email sent to:", email)
  } catch (error) {
    console.error("[v0] Failed to send verification email:", error)
    throw new Error("Failed to send verification email")
  }
}

export async function sendEventEditLinkEmail(to: string, eventTitle: string, eventId: string, token: string) {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000"
  const editUrl = `${baseUrl}/my/events/${eventId}/edit?token=${encodeURIComponent(token)}`
  const subject = `Edit link for "${escapeHtml(eventTitle)}"`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edit Your Event</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Eventa</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your Event Edit Link</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="margin-top: 0; color: #111827;">Edit Your Event</h2>
          <p style="font-size: 16px; margin-bottom: 20px;">You can edit <strong>${escapeHtml(eventTitle)}</strong> any time until the event ends.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${editUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Edit this event</a>
          </div>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">If the button doesn't work, paste this into your browser:</p>
            <p style="margin: 0; font-size: 13px; word-break: break-all; color: #667eea;">${editUrl}</p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            This link expires automatically after the event ends (plus a short grace period). Keep this email safe to make changes to your event.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Eventa. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
Edit Your Event

You can edit "${eventTitle}" any time until the event ends.

Visit this link to edit your event:
${editUrl}

This link expires automatically after the event ends (plus a short grace period). Keep this email safe to make changes to your event.

© ${new Date().getFullYear()} Eventa. All rights reserved.
  `.trim()

  if (!transporter) {
    console.log("[v0] Email not configured. Edit link details:")
    console.log("[v0] To:", to)
    console.log("[v0] Event:", eventTitle)
    console.log("[v0] Edit URL:", editUrl)
    return
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    })
    console.log("[v0] Edit link email sent to:", to)
  } catch (error) {
    console.error("[v0] Failed to send edit link email:", error)
    throw new Error("Failed to send edit link email")
  }
}
