"use server";
import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM || "no-reply@ithakigrouptour.com";

// Normalize APP_URL (remove trailing slash)
const RAW_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const APP_URL = RAW_APP_URL.replace(/\/+$/, "");

/* -------------------------------------------------------------------------- */
/*  Core sender                                                               */
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
/*  Strict email sender (throws to caller)                                    */
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
/*  Safe email sender (never throws)                                          */
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
/*  Build a safe, encoded edit URL                                            */
/* -------------------------------------------------------------------------- */
function buildEditUrl(eventId: string, token: string): string {
  const encodedToken = encodeURIComponent(token);
  return `${APP_URL}/edit/${eventId}?token=${encodedToken}`;
}

/* -------------------------------------------------------------------------- */
/*  Event Edit Link: MAIN PUBLIC FUNCTION                                     */
/* -------------------------------------------------------------------------- */
export async function sendEventEditLinkEmailAPI(
  to: string,
  eventTitle: string,
  eventId: string,
  token: string
) {
  const editUrl = buildEditUrl(eventId, token);

  const escapedTitle = eventTitle
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `
    <div style="font-family:Arial, sans-serif; max-width:560px; margin:0 auto;">
      <h2>Your Event Was Submitted</h2>

      <p>Thanks for submitting <strong>${escapedTitle}</strong>.</p>
      <p>You can edit your event anytime using the link below:</p>

      <p style="margin:24px 0;">
        <a href="${editUrl}" 
           style="background:#000; color:#fff; padding:12px 20px; 
                  text-decoration:none; border-radius:6px; display:inline-block;">
          Edit Your Event
        </a>
      </p>

      <p style="font-size:13px; color:#777;">
        Or open this link:<br>
        <a href="${editUrl}">${editUrl}</a>
      </p>
    </div>
  `;

  return await coreSend(
    to,
    `Your Event: "${escapedTitle}" — Edit Link`,
    html
  );
}

/* -------------------------------------------------------------------------- */
/*  Legacy compatibility wrapper                                              */
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
