import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return NextResponse.json({
        ok: false,
        error: "Missing SMTP env vars",
      });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: SMTP_FROM,      // send back to yourself
      subject: "Test email from Eventa",
      text: "✅ SMTP test successful!",
    });

    return NextResponse.json({ ok: true, message: "Email sent!" });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message ?? String(err),
    });
  }
}
