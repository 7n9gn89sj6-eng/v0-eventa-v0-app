"use server";
import "server-only";
import { Resend } from "resend";

// ---------------------------------------------------------------------------
//  RESEND CLIENT
// ---------------------------------------------------------------------------
if (!process.env.RESEND_API_KEY) {
  console.error("[email] Missing RESEND_API_KEY — emails will fail.");
}

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
//  GENERIC EMAIL SENDER
// ---------------------------------------------------------------------------
export async function sendEmailAPI({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "no-reply@ithakigrouptour.com",
      to,
      subject,
      html,
    });

    console.log("[email] sent OK:", result);
    return { success: true, result };
  } catch (error: any) {
    console.error("[email] send failed:", error);
    return {
      success: false,
      error: error?.message || "Unknown email error",
    };
  }
}

// ---------------------------------------------------------------------------
//  SAFE EMAIL SENDER (NEVER THROWS) — used by admin notifications + AI
// ---------------------------------------------------------------------------
export async function sendSafeEmail({
  to,
  subject,
  html,
  emailType,
  eventId,
}: {
  to: string;
  subject: string;
  html: string;
  emailType: string;
  eventId?: string;
}) {
  try {
    const result = await sendEmailAPI({ to, subject, html });

    if (!result.success) {
      console.error("[email] safeSend failed:", result.error);
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      messageId: result.result?.data?.id || null,
    };
  } catch (error: any) {
    console.error("[email] safeSend fatal error:", error);
    return {
      success: false,
      error: error?.message || "Unknown safeSend error",
    };
  }
}

// ---------------------------------------------------------------------------
//  EVENT EDIT LINK EMAIL — sent after event submission
// ---------------------------------------------------------------------------
export async function sendEventEditLinkEmailAPI(
  to: string,
  eventTitle: string,
  eventId: string,
  token: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const editLink = `${appUrl}/edit/${eventId}?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#333;">Your Event Was Submitted</h2>
      <p style="font-size: 15px; color: #444;">
        Thanks for submitting <strong>${eventTitle}</strong>.
      </p>
      <p style="font-size: 15px; color: #444;">
        You can edit or update your event anytime using the secure link below:
      </p>

      <p style="margin:20px 0;">
        <a href="${editLink}"
           style="background:#000; color:#fff; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:bold;">
          Edit Your Event
        </a>
      </p>

      <p style="font-size: 13px; color: #777;">
        Or use this link:<br>
        <a href="${editLink}" style="color:#0066ff;">${editLink}</a>
      </p>
    </div>
  `;

  return sendEmailAPI({
    to,
    subject: `Your Event: "${eventTitle}" — Edit Link`,
    html,
  });
}
