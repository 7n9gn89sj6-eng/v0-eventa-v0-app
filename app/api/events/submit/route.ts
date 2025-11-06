import nodemailer from "nodemailer"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)

    if (!body || !body.email) {
      return Response.json(
        { error: "Missing email or form data" },
        { status: 400 },
      )
    }

    // Build confirm URL from env (fallback for local dev)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // If your submit already generates a token, reuse it; otherwise create one now
    const token: string = body.token ?? crypto.randomUUID()
    const confirmUrl = `${baseUrl}/event/confirm?token=${encodeURIComponent(token)}`

    // Nodemailer transport from env (Mailtrap / SMTP)
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || 587),
      secure: Number(process.env.MAIL_PORT || 587) === 465, // secure only for 465
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    })

    // HTML email + plain-text fallback
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111;">
        <h1 style="margin:0 0 16px;">Confirm your Event on Eventa</h1>
        <p>Thanks for submitting your event. Click the button below to confirm and publish it.</p>
        <p style="margin:24px 0;">
          <a href="${confirmUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
            Confirm &amp; Publish
          </a>
        </p>
        <p>If the button doesn’t work, copy and paste this link:</p>
        <p><a href="${confirmUrl}">${confirmUrl}</a></p>
        <p style="margin-top:24px;color:#666;font-size:12px;">You can use this link later to edit your event.</p>
      </div>
    `.trim()

    const text = [
      "Confirm your Event on Eventa",
      "",
      "Thanks for submitting your event.",
      "Open this link to confirm & publish:",
      confirmUrl,
      "",
      "You can use this link later to edit the event.",
    ].join("\n")

    await transporter.sendMail({
      from: process.env.MAIL_FROM || "no-reply@eventa.test",
      to: body.email,
      subject: "Confirm your Event on Eventa",
      text,
      html,
    })

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("❌ Email/API error:", error)
    return Response.json(
      { error: "Server error while submitting event" },
      { status: 500 },
    )
  }
}

// Optional health check
export async function GET() {
  return Response.json({ ok: true })
}
