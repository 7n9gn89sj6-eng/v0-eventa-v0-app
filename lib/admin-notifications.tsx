import { sendEmail } from "./email"

export async function notifyAdminOfFlaggedEvent(event: {
  id: string
  title: string
  description: string
  moderationStatus: string
  moderationReason: string
  moderationSeverity: string
  moderationCategory: string
}) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM

  if (!adminEmail) {
    console.warn("[v0] No admin email configured for moderation alerts")
    return
  }

  const severityEmoji =
    {
      HIGH: "🚨",
      MEDIUM: "⚠️",
      LOW: "ℹ️",
    }[event.moderationSeverity] || "⚠️"

  const subject = `${severityEmoji} Event ${event.moderationStatus}: ${event.title}`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Event Moderation Alert</h2>
      
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; font-weight: bold;">Status: ${event.moderationStatus}</p>
        <p style="margin: 8px 0 0 0;">Severity: ${event.moderationSeverity}</p>
      </div>

      <h3>Event Details</h3>
      <p><strong>Title:</strong> ${event.title}</p>
      <p><strong>Description:</strong> ${event.description}</p>

      <h3>Moderation Analysis</h3>
      <p><strong>Category:</strong> ${event.moderationCategory}</p>
      <p><strong>Reason:</strong> ${event.moderationReason}</p>

      <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px;">
        <p style="margin: 0;"><strong>Action Required:</strong></p>
        <p style="margin: 8px 0 0 0;">
          Please review this event in the admin dashboard and take appropriate action.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/events/${event.id}" 
           style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
          Review Event
        </a>
      </div>
    </div>
  `

  try {
    await sendEmail({
      to: adminEmail,
      subject,
      html,
    })
    console.log(`[v0] ✓ Admin notification sent for ${event.moderationStatus} event: ${event.id}`)
  } catch (error) {
    console.error("[v0] ✗ Failed to send admin notification:", error)
  }
}
