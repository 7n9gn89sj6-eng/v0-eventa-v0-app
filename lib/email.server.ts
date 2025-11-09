import 'server-only'

let transporter: any | null = null

async function getTransporter() {
  if (transporter) return transporter
  const nodemailer = await import('nodemailer') // dynamic import keeps it out of client bundles

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT || 2525),
    secure: false, // STARTTLS (Mailtrap)
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
    // Throttle to avoid Mailtrap rate limit
    pool: true,
    maxConnections: 1,
    maxMessages: Infinity,
    rateDelta: 2000,
    rateLimit: 1,
  })

  return transporter
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text?: string
  html?: string
}) {
  const tx = await getTransporter()
  const from = process.env.EMAIL_FROM || 'Eventa <noreply@example.com>'
  return tx.sendMail({ from, to, subject, text, html })
}
