"use server"

import { Resend } from "resend"
import { sql } from "./db"

const resend = new Resend(process.env.RESEND_API_KEY)

export function generateEditToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "")
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function createEditTokenForEvent(eventId: string): Promise<string> {
  const token = generateEditToken()
  const tokenHash = await hashToken(token)
  const expires = new Date()
  expires.setDate(expires.getDate() + 30) // 30 days from now

  await sql`
    INSERT INTO "EventEditToken" (id, "eventId", "tokenHash", expires, "createdAt")
    VALUES (${crypto.randomUUID().replace(/-/g, "")}, ${eventId}, ${tokenHash}, ${expires.toISOString()}, NOW())
  `

  return token
}

export async function sendEditLinkEmail(email: string, eventTitle: string, eventId: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const editUrl = `${baseUrl}/edit/${eventId}?token=${token}`

  const subject = `Edit link for "${eventTitle}"`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 32px; }
          .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }
          .content { padding: 40px 20px; background: white; }
          .content h2 { color: #1a1a1a; font-size: 24px; margin: 0 0 20px 0; }
          .content p { color: #4a4a4a; line-height: 1.6; margin: 0 0 20px 0; }
          .button { display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .button:hover { background: #5568d3; }
          .fallback { background: #f5f5f5; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .fallback p { margin: 0 0 10px 0; font-size: 14px; color: #666; }
          .fallback a { color: #667eea; word-break: break-all; font-size: 13px; }
          .footer { padding: 20px; text-align: center; color: #999; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Eventa</h1>
            <p>Your Event Edit Link</p>
          </div>
          <div class="content">
            <h2>Edit Your Event</h2>
            <p>You can edit <strong>${eventTitle}</strong> any time using this secure link. No sign-in required!</p>
            <a href="${editUrl}" class="button">Edit this event</a>
            <div class="fallback">
              <p>If the button doesn't work, paste this into your browser:</p>
              <a href="${editUrl}">${editUrl}</a>
            </div>
            <p style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
              This link expires 30 days after creation. Keep this email safe to make changes to your event.
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Eventa. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@eventa.test",
      to: email,
      subject,
      html,
    })
    return { success: true }
  } catch (error) {
    console.error("[v0] Error sending email:", error)
    return { success: false, error: "Failed to send email" }
  }
}
