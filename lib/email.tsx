import "server-only"
import nodemailer from "nodemailer"

export type EmailResult = 
  | { success: true; messageId: string }
  | { success: false; error: string }

function getResendClient() {
  const host = process.env.EMAIL_SERVER_HOST
  const port = process.env.EMAIL_SERVER_PORT
  const user = process.env.EMAIL_SERVER_USER
  const pass = process.env.EMAIL_SERVER_PASSWORD

  if (!host || !port || !user || !pass) {
    console.error("[v0] SMTP credentials not configured")
    throw new Error(
      "Email service is not configured. Please set EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, and EMAIL_SERVER_PASSWORD environment variables.",
    )
  }

  return nodemailer.createTransport({
    host,
    port: Number.parseInt(port),
    auth: {
      user,
      pass,
    },
  })
}

async function sendEmailWithRetry(
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
  retries = 3
): Promise<nodemailer.SentMessageInfo> {
  for (let i = 0; i < retries; i++) {
    try {
      const info = await transporter.sendMail(mailOptions)
      return info
    } catch (error) {
      console.error(`[v0] Email send attempt ${i + 1} failed:`, error)
      
      // If this was the last retry, throw the error
      if (i === retries - 1) {
        throw error
      }
      
      // Exponential backoff: wait 1s, 2s, 4s before retrying
      const waitTime = 1000 * Math.pow(2, i)
      console.log(`[v0] Retrying email send in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  throw new Error("Email send failed after all retries")
}

export async function sendSafeEmail({
  to,
  subject,
  html,
  emailType = "generic",
  eventId,
}: {
  to: string
  subject: string
  html: string
  emailType?: "event_edit_link" | "verification" | "appeal_notification" | "generic"
  eventId?: string
}): Promise<EmailResult> {
  try {
    const transporter = getResendClient()
    const from = process.env.EMAIL_FROM || "noreply@example.com"

    const info = await sendEmailWithRetry(transporter, {
      from,
      to,
      subject,
      html,
    })

    console.log(`[v0] Email sent successfully - Type: ${emailType}, To: ${to}, ID: ${info.messageId}`)
    
    // Create audit log for email success if eventId provided
    if (eventId) {
      try {
        const { createAuditLog } = await import("@/lib/audit-log")
        await createAuditLog({
          eventId,
          actor: "user",
          action: "EMAIL_SENT",
          notes: `Email sent successfully - Type: ${emailType}, To: ${to}`,
        })
      } catch (auditError) {
        console.error("[v0] Failed to create email success audit log:", auditError)
      }
    }

    return { success: true, messageId: info.messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorName = error instanceof Error ? error.name : "Unknown"
    
    console.error(`[v0] Email send failed - Type: ${emailType}, To: ${to}`, {
      errorType: errorName,
      errorMessage,
    })

    // Create audit log for email failure if eventId provided
    if (eventId) {
      try {
        const { createAuditLog } = await import("@/lib/audit-log")
        await createAuditLog({
          eventId,
          actor: "user",
          action: "EMAIL_SEND_FAILED",
          notes: `Email send failed - Type: ${emailType}, To: ${to}, Error: ${errorName}`,
          reason: errorMessage,
        })
        console.log("[v0] Email failure audit log created successfully")
      } catch (auditError) {
        console.error("[v0] Failed to create email failure audit log:", auditError)
      }
    }

    return { success: false, error: errorMessage }
  }
}

export async function sendVerificationEmail(email: string, code: string): Promise<EmailResult> {
  try {
    const transporter = getResendClient()
    const from = process.env.EMAIL_FROM || "noreply@example.com"

    const info = await sendEmailWithRetry(transporter, {
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

    console.log("[v0] Verification email sent successfully to:", email, "ID:", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("[v0] Error sending verification email:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to send verification email" }
  }
}

export async function sendEventEditLinkEmail(
  to: string,
  eventTitle: string,
  eventId: string,
  token: string
): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const editLink = `${appUrl}/edit/${eventId}?token=${token}`

  return sendSafeEmail({
    to,
    subject: `Event Submitted: ${eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You for Your Submission!</h2>
        <p>Your event "<strong>${eventTitle}</strong>" has been submitted successfully and is awaiting approval.</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${editLink}" 
             style="background-color: #000; color: #fff; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block; 
                    font-weight: bold;">
            Edit Your Event
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">
          You can use this link to edit your event details at any time.<br>
          This link expires in 30 days.
        </p>
        
        <p style="color: #666; margin-top: 30px;">
          Our team will review your submission shortly. You'll receive another email once your event is approved.
        </p>
      </div>
    `,
    emailType: "event_edit_link",
    eventId,
  })
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<EmailResult> {
  return sendSafeEmail({
    to,
    subject,
    html,
    emailType: "generic",
  })
}
