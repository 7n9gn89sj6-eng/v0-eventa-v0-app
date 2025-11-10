export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function makeTransport() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT || '2525');
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;

  if (!host || !port || !user || !pass || !from) {
    throw new Error('Missing email server env vars');
  }

  // Mailtrap Sandbox works with STARTTLS on 2525 (secure=false)
  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    }),
    from,
  };
}

/**
 * POST /api/email/verify-event
 * Body JSON: { to: string, verifyUrl: string, eventTitle?: string }
 * Sends a verification email with a link the user can click.
 */
export async function POST(req: Request) {
  try {
    const { to, verifyUrl, eventTitle } = await req.json?.() ?? {};

    if (!to || !verifyUrl) {
      return NextResponse.json(
        { ok: false, error: 'Missing "to" or "verifyUrl"' },
        { status: 400 }
      );
    }

    const { transporter, from } = makeTransport();

    const subject =
      'Verify your Event' + (eventTitle ? `: ${eventTitle}` : '');

    const html = `
      <p>Thanks for submitting your event to Eventa.</p>
      <p>Please click the link below to verify and publish:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>If you didn’t request this, you can ignore this email.</p>
    `;
    const text = `Verify your event: ${verifyUrl}`;

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

