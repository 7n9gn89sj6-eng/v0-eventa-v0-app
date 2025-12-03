// /lib/admin-email.ts
import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendAdminEmailInput = {
  to: string;
  subject: string;
  html: string;
  eventId: string;
};

/**
 * Safe wrapper around Resend email sending.
 * - Never throws
 * - Always returns { success, messageId?, error? }
 */
export async function sendAdminEmail({
  to,
  subject,
  html,
  eventId,
}: SendAdminEmailInput): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: "Missing RESEND_API_KEY",
    };
  }

  if (!to) {
    return {
      success: false,
      error: "Missing admin email recipient",
    };
  }

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "no-reply@eventa.app",
      to,
      subject,
      html,
      tags: [
        { name: "event-id", value: eventId },
        { name: "type", value: "admin-notification" },
      ],
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unknown error sending admin email",
    };
  }
}
