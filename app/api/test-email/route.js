export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT || 2525),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },

      // ✅ Throttle so Mailtrap doesn't reject bursts
      pool: true,
      maxConnections: 1,
      maxMessages: Infinity,
      rateDelta: 2000, // 1 window = 2000ms
      rateLimit: 1,    // 1 email per window
    });

    // Optional sanity check
    await transporter.verify();

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Eventa <noreply@example.com>',
      to: 'to@example.com',
      subject: '✅ Mailtrap SMTP Test',
      text: 'Your Mailtrap setup works perfectly!',
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

