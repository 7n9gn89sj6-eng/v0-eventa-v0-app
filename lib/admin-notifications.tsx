// lib/admin-notifications.ts

import { db } from "@/lib/db";
import { resend } from "@/lib/email/resend"; // Your existing Resend client
import { getBaseUrl } from "@/lib/utils";

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;

/* ============================================================
   NOTIFY ADMINS: Event requires human review (AI flagged)
   (This already existed — cleanly preserved)
============================================================ */

export async function notifyAdminsEventNeedsReview({
  eventId,
  title,
  city,
  country,
  aiStatus,
  aiReason,
}: {
  eventId: string;
  title: string;
  city?: string | null;
  country?: string | null;
  aiStatus: string;
  aiReason?: string | null;
}) {
  const admins = await db.user.findMany({
    where: { isAdmin: true },
    select: { email: true },
  });

  const recipients =
    admins.length > 0
      ? admins.map((a) => a.email)
      : DEFAULT_ADMIN_EMAIL
      ? [DEFAULT_ADMIN_EMAIL]
      : [];

  if (recipients.length === 0) return;

  const url = `${getBaseUrl()}/admin/events/${eventId}`;

  await resend.emails.send({
    from: "Eventa <no-reply@eventa.app>",
    to: recipients,
    subject: `Event requires review: ${title}`,
    html: `
      <p><strong>${title}</strong></p>
      <p>AI Status: ${aiStatus}</p>
      <p>${aiReason ?? ""}</p>
      <p>Location: ${city ?? ""}, ${country ?? ""}</p>
      <p><a href="${url}">Review this event</a></p>
    `,
  });
}

/* ============================================================
   NEW — NOTIFY ADMINS: Admin took moderation action
============================================================ */

export async function notifyAdminsEventUpdated({
  eventId,
  title,
  action,
  adminEmail,
  reason,
}: {
  eventId: string;
  title: string;
  action: string;
  adminEmail: string | null;
  reason?: string | null;
}) {
  const admins = await db.user.findMany({
    where: { isAdmin: true },
    select: { email: true },
  });

  const recipients =
    admins.length > 0
      ? admins.map((a) => a.email)
      : DEFAULT_ADMIN_EMAIL
      ? [DEFAULT_ADMIN_EMAIL]
      : [];

  if (!recipients.length) return;

  const url = `${getBaseUrl()}/admin/events/${eventId}`;

  await resend.emails.send({
    from: "Eventa <no-reply@eventa.app>",
    to: recipients,
    subject: `Admin updated event: ${title}`,
    html: `
      <p><strong>${title}</strong></p>
      <p><strong>Action:</strong> ${action}</p>
      <p><strong>Updated by:</strong> ${adminEmail ?? "Unknown admin"}</p>
      ${
        reason
          ? `<p><strong>Reason:</strong> ${reason}</p>`
          : ""
      }
      <p><a href="${url}">View event in dashboard</a></p>
    `,
  });
}

