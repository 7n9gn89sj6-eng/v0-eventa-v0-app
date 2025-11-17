import "server-only"
import nodemailer from "nodemailer"

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

export async function sendVerificationEmail(email: string, code: string) {
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
  } catch (error) {
    console.error("[v0] Error sending verification email:", error)
    throw error instanceof Error ? error : new Error("Failed to send verification email")
  }
}

export async function sendEventEditLinkEmail(to: string, eventTitle: string, eventId: string, token: string) {
  try {
    const transporter = getResendClient()
    const from = process.env.EMAIL_FROM || "noreply@example.com"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const editLink = `${appUrl}/edit/${token}`

    const info = await sendEmailWithRetry(transporter, {
      from,
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
    })

    console.log("[v0] Submission email sent successfully")
    console.log("[v0] Email recipient:", to)
    console.log("[v0] Email message ID:", info.messageId)
  } catch (error) {
    console.error("[v0] Error sending submission email:", error)
    throw error instanceof Error ? error : new Error("Failed to send submission email")
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
    const transporter = getResendClient()
    const from = process.env.EMAIL_FROM || "noreply@example.com"

    const info = await sendEmailWithRetry(transporter, {
      from,
      to,
      subject,
      html,
    })

    console.log("[v0] Email sent successfully to:", to, "subject:", subject, "ID:", info.messageId)
  } catch (error) {
    console.error("[v0] Error sending email:", error)
    throw error instanceof Error ? error : new Error("Failed to send email")
  }
}
