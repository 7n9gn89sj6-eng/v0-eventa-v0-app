import nodemailer from "nodemailer"
import "server-only"

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

// All email functionality has been temporarily disabled for deployment

export async function sendVerificationEmail(email: string, code: string) {
  console.log("[v0] Email disabled - TODO restore later")
  console.log("[v0] Would have sent verification email to:", email, "with code:", code)
  // Email functionality disabled for deployment
  return Promise.resolve()
}

export async function sendEventEditLinkEmail(to: string, eventTitle: string, eventId: string, token: string) {
  console.log("[v0] Email disabled - TODO restore later")
  console.log("[v0] Would have sent edit link to:", to, "for event:", eventTitle)
  // Email functionality disabled for deployment
  return Promise.resolve()
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
  console.log("[v0] Email disabled - TODO restore later")
  console.log("[v0] Would have sent email to:", to, "subject:", subject)
  // Email functionality disabled for deployment
  return Promise.resolve()
}

// Additional updates can be made here if needed
