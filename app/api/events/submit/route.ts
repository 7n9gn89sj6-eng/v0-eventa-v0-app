import nodemailer from "nodemailer"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)

    if (!body || !body.email) {
      return Response.json(
        { error: "Missing email or form data" },
        { status: 400 }
      )
    }

    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || 587),
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.MAIL_FROM || "no-reply@eventa.test",
      to: body.email,
      subject: "Confirm your Event on Eventa",
      text:
        `Thanks for submitting your event!\n\n` +
        `Click this link to confirm and publish (placeholder for now):\n` +
        `http://localhost:3000/events/confirm-demo\n\n` +
        `You can use this link later to edit the event too.`,
    })

    return Response.json(
      { success: true, message: "Event submitted & email sent" },
      { status: 200 }
    )
  } catch (error) {
    console.error("❌ Email/API error:", error)
    return Response.json(
      { error: "Server error while submitting event" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return Response.json({ ok: true })
}
