"use server";
import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "no-reply@ithakigrouptour.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/* -------------------------------------------------------------------------- */
/*  Core sender (lowest level)                                                */
/* -------------------------------------------------------------------------- */
async function coreSend(to: string, subject: string, html: string) {
  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    });

    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Email send error" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API: strict sender                                                 */
/* -------------------------------------------------------------------------- */
export async function sendEmailAPI({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  return await coreSend(to, subject, html);
}

/* -------------------------------------------------------------------------- */
/*  Public API: safe sender (never throws)                                    */
/* -------------------------------------------------------------------------- */
export async function sendSafeEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const res = await coreSend(to, subject, html);

  if (!res.success) {
    return { success: false, error: res.error };
  }

  return { success: true, messageId: res.result?.data?.id || null };
}

/* -------------------------------------------------------------------------- */
/*  Event Edit Link Email                                                     */
/* -------------------------------------------------------------------------- */
export async function sendEventEditLinkEmailAPI(
  to: string,
  eventTitle: string,
  eventId: string,
  token: string
) {
  const editUrl = `${APP_URL}/edit/${eventId}?token=${token}`;

  const html = `
    <div style="font-family:Arial;max-width:560px;margin:0 auto;">
      <h2>Your Event Was Submitted</h2>
      <p>Thanks for submitting <strong>${eventTitle}</strong>.</p>
      <p>You can edit your event anytime using the link below:</p>

      <p style="margin:20px 0;">
        <a href="${editUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">
          Edit Your Event
        </a>
      </p>

      <p style="font-size:13px;color:#777;">
        Or open this link:<br>
        <a href="${editUrl}">${editUrl}</a>
      </p>
    </div>
  `;

  return await coreSend(to, `Your Event: "${eventTitle}" — Edit Link`, html);
}

/* -------------------------------------------------------------------------- */
/*  Legacy compatibility: sendEmail()                                         */
/* -------------------------------------------------------------------------- */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  return await coreSend(to, subject, html);
}
