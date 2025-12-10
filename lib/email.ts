export async function sendEventEditLinkEmailAPI(
  to: string,
  eventTitle: string,
  eventId: string,
  token: string
) {
  // CORRECT ROUTE FIXED HERE
  const editUrl = `${APP_URL}/events/${eventId}/edit?token=${token}`;

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
