"use server";
import "server-only";

import { Resend } from "resend";

/* -------------------------------------------------------------------------- */
/*  Environment + URL hardening                                               */
/* -------------------------------------------------------------------------- */

const RAW_FROM = process.env.EMAIL_FROM || "no-reply@ithakigrouptour.com";
const RAW_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const RESEND_KEY = process.env.RESEND_API_KEY;

// Normalise base app URL, strip trailing slash, warn on bad config
function resolveAppUrl(raw: string): string {
  try {
    const url = new URL(raw);

    // In production we really want HTTPS
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      console.warn(
        "[email] WARNING: NEXT_PUBLIC_APP_URL is not HTTPS in production:",
        raw
      );
    }

    // Remove trailing slash on pathname to avoid double slashes later
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${pathname}`;
  } catch (err) {
    console.error("[email] Invalid NEXT_PUBLIC_APP_URL, falling back to localhost:", raw, err);
    return "http://localhost:3000";
  }
}

const APP_URL = resolveAppUrl(RAW_APP_URL);
const FROM = RAW_FROM;

// Only create Resend client if we actually have a key
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

// Very small sanity check – not a full validator but enough to catch garbage
function isPlausibleEmail(address: string): boolean {
  return typeof address === "string" && address.includes("@") && address.length <= 320;
}

// Minimal HTML escaping to avoid HTML injection via user fields (titles, etc.)
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Safe URL builder for app links
function buildAppUrl(path: string, query?: Record<string, string | undefined>): string {
  const base = APP_URL; // already normalised, no trailing slash
  const cleanedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(base + cleanedPath);

  if (query) {
    for (const [key, val] of Object.entries(query)) {
      if (typeof val === "string" && val.length > 0) {
        url.searchParams.set(key, val);
      }
    }
  }

  return url.toString();
}

/* -------------------------------------------------------------------------- */
/*  Core sender – single place that touches Resend                            */
/* -------------------------------------------------------------------------- */

async function coreSend(to: string, subject: string, html: string) {
  if (!resend || !RESEND_KEY) {
    const msg = "[email] RESEND_API_KEY missing – email not sent";
    console.error(msg);
    return { success: false, error: msg };
  }

  if (!isPlausibleEmail(to)) {
    const msg = "[email] Refusing to send to invalid email address";
    console.warn(msg, { to });
    return { success: false, error: msg };
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    });

    return { success: true, result };
  } catch (err: any) {
    const message = err?.message || "Email send error";
    console.error("[email] Send failed:", message);
    return { success: false, error: message };
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
  // subject/html are assumed to be trusted templates at this layer
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
    return { success: false as const, error: res.error };
  }

  return {
    success: true as const,
    messageId: res.result?.data?.id || null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Event Edit Link Email (hardened)                                          */
/* -------------------------------------------------------------------------- */

export async function sendEventEditLinkEmailAPI(
  to: string,
  eventTitle: string,
  eventId: string,
  token: string
) {
  // Build URL via helper to ensure proper encoding
  const editUrl = buildAppUrl(`/edit/${eventId}`, { token });

  // Escape event title for safe HTML rendering
  const safeTitle = escapeHtml(eventTitle);

  const html = `
    <div style="font-family:Arial, sans-serif; max-width:560px; margin:0 auto;">
      <h2>Your Event Was Submitted</h2>
      <p>Thanks for submitting <strong>${safeTitle}</strong>.</p>
      <p>You can edit your event anytime using the link below:</p>

      <p style="margin:20px 0;">
        <a href="${editUrl}"
           style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">
          Edit Your Event
        </a>
      </p>

      <p style="font-size:13px;color:#777;line-height:1.5;">
        Or open this link:<br>
        <a href="${editUrl}">${editUrl}</a>
      </p>
    </div>
  `;

  const subject = `Your Event: "${safeTitle}" — Edit Link`;

  return await coreSend(to, subject, html);
}

/* -------------------------------------------------------------------------- */
/*  Legacy compatibility                                                      */
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
