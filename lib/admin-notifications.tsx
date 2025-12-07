// lib/admin-notifications.tsx
"use server";
import "server-only";

import { sendSafeEmail } from "@/lib/email";

const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_FROM || "";

if (!DEFAULT_ADMIN_EMAIL) {
  console.warn(
    "[admin-notifications] No ADMIN_NOTIFICATION_EMAIL or EMAIL_FROM set – admin emails will be skipped."
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type NeedsReviewArgs = {
  eventId: string;
  title: string;
  city?: string | null;
  country?: string | null;
  aiStatus?: string | null;
  aiReason?: string | null;
};

export async function notifyAdminsEventNeedsReview(args: NeedsReviewArgs) {
  if (!DEFAULT_ADMIN_EMAIL) {
    return { success: false, error: "No admin email configured" };
  }

  const { eventId, title, city, country, aiStatus, aiReason } = args;

  const link = `${APP_URL}/admin?event=${encodeURIComponent(eventId)}`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">Event requires manual review</h2>
      <p style="margin: 0 0 16px 0; color: #4b5563;">Eventa – AI moderation flag</p>

      <div style="padding: 12px 16px; background: #fef3c7; border-left: 4px solid #f59e0b; margin-bottom: 16px;">
        <p style="margin: 0; font-weight: 600;">${title}</p>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #4b5563;">
          ${[city, country].filter(Boolean).join(", ") || "Location unknown"}
        </p>
      </div>

      <p style="font-size: 14px; color: #374151; margin-bottom: 12px;">
        AI status: <strong>${aiStatus || "NEEDS_REVIEW"}</strong>
      </p>

      ${
        aiReason
          ? `<p style="font-size: 14px; color: #374151; margin-bottom: 16px;">
               Reason: ${aiReason}
             </p>`
          : ""
      }

      <p style="margin: 20px 0;">
        <a href="${link}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600;">
          Open Admin Panel
        </a>
      </p>

      <p style="font-size: 12px; color:#6b7280; margin-top:24px;">
        Event ID: ${eventId}
      </p>
    </div>
  `;

  return sendSafeEmail({
    to: DEFAULT_ADMIN_EMAIL,
    subject: `Event needs review: ${title}`,
    html,
    emailType: "admin_event_needs_review",
    eventId,
  });
}

type UpdatedArgs = {
  eventId: string;
  title: string;
  action: string;
  adminEmail?: string | null;
  reason?: string | null;
};

export async function notifyAdminsEventUpdated(args: UpdatedArgs) {
  if (!DEFAULT_ADMIN_EMAIL) {
    return { success: false, error: "No admin email configured" };
  }

  const { eventId, title, action, adminEmail, reason } = args;
  const link = `${APP_URL}/admin?event=${encodeURIComponent(eventId)}`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">Admin moderation action</h2>
      <p style="margin: 0 0 16px 0; color: #4b5563;">Eventa – Moderation update</p>

      <div style="padding: 12px 16px; background: #eef2ff; border-left: 4px solid #4f46e5; margin-bottom: 16px;">
        <p style="margin: 0; font-weight: 600;">${title}</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #4b5563;">
          Action: <strong>${action}</strong>${
            adminEmail ? ` by <strong>${adminEmail}</strong>` : ""
          }
        </p>
      </div>

      ${
        reason
          ? `<p style="font-size: 14px; color: #374151; margin-bottom: 16px;">
               Reason: ${reason}
             </p>`
          : ""
      }

      <p style="margin: 20px 0;">
        <a href="${link}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600;">
          Open Admin Panel
        </a>
      </p>

      <p style="font-size: 12px; color:#6b7280; margin-top:24px;">
        Event ID: ${eventId}
      </p>
    </div>
  `;

  return sendSafeEmail({
    to: DEFAULT_ADMIN_EMAIL,
    subject: `Admin action on event: ${title}`,
    html,
    emailType: "admin_event_updated",
    eventId,
  });
}
