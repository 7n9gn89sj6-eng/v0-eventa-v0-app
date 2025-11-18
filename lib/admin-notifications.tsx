import "server-only"
import type { EventAIStatus } from "./types"
import { sendSafeEmail } from "./email"
import { createAuditLog } from "./audit-log"

type AdminEventNotificationInput = {
  eventId: string
  title: string
  city?: string | null
  country?: string | null
  aiStatus: EventAIStatus
  aiReason?: string | null
}

/**
 * Sends email notification to admins when an event needs manual review.
 * This is called when AI moderation flags an event as NEEDS_REVIEW.
 * 
 * Configuration:
 * - Requires ADMIN_NOTIFICATION_EMAIL environment variable
 * - Falls back gracefully if email is not configured
 * - Never throws errors - always safe to call
 * 
 * @param input Event details for the notification
 */
export async function notifyAdminsEventNeedsReview(
  input: AdminEventNotificationInput
): Promise<void> {
  // 1) Read ADMIN_NOTIFICATION_EMAIL from env
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  
  if (!adminEmail) {
    console.log("[v0] ADMIN_NOTIFICATION_EMAIL not configured - skipping admin notification")
    console.log("[v0] To enable admin notifications, set ADMIN_NOTIFICATION_EMAIL environment variable")
    return
  }
  
  console.log("[v0] Sending admin notification for event:", input.eventId)
  
  // 2) Build admin review link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  let adminReviewLink: string
  
  if (appUrl) {
    adminReviewLink = `${appUrl}/admin/events/${input.eventId}`
  } else {
    // Fallback to relative URL if NEXT_PUBLIC_APP_URL not set
    adminReviewLink = `/admin/events/${input.eventId}`
    console.warn("[v0] NEXT_PUBLIC_APP_URL not set - using relative URL for admin link")
  }
  
  // 3) Build location string
  const location = [input.city, input.country].filter(Boolean).join(", ") || "Unknown location"
  
  // 4) Build email subject and body
  const subject = `Event needs review: ${input.title}`
  
  const statusEmoji = input.aiStatus === "NEEDS_REVIEW" ? "⚠️" : "🚨"
  const statusLabel = input.aiStatus === "NEEDS_REVIEW" ? "Needs Review" : "Rejected"
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ea580c;">${statusEmoji} Event Requires Admin Review</h2>
      
      <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; font-weight: bold;">Status: ${statusLabel}</p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">This event was flagged by AI moderation and requires manual review.</p>
      </div>
      
      <h3 style="margin-top: 24px;">Event Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; width: 120px;">Title:</td>
          <td style="padding: 8px 0;">${input.title}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Location:</td>
          <td style="padding: 8px 0;">${location}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">AI Status:</td>
          <td style="padding: 8px 0;">${input.aiStatus}</td>
        </tr>
        ${input.aiReason ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">AI Reason:</td>
          <td style="padding: 8px 0;">${input.aiReason}</td>
        </tr>
        ` : ''}
      </table>
      
      <div style="margin-top: 32px; padding: 20px; background: #f9fafb; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 16px 0; font-weight: bold;">Action Required</p>
        <a href="${adminReviewLink}" 
           style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; 
                  text-decoration: none; border-radius: 6px; font-weight: bold;">
          Review Event in Admin Panel
        </a>
      </div>
      
      <p style="margin-top: 24px; font-size: 14px; color: #666;">
        Please review this event and either approve it for publication or reject it with feedback to the creator.
      </p>
    </div>
  `
  
  // 5) Send email using sendSafeEmail
  try {
    const emailResult = await sendSafeEmail({
      to: adminEmail,
      subject,
      html,
      emailType: "generic",
      eventId: input.eventId,
    })
    
    if (emailResult.success) {
      console.log("[v0] Admin notification email sent successfully:", emailResult.messageId)
      
      // Create audit log for successful notification
      try {
        await createAuditLog({
          eventId: input.eventId,
          actor: "ai",
          action: "ADMIN_NOTIFIED",
          notes: `Admin notification sent to ${adminEmail} - Event flagged as ${input.aiStatus}`,
        })
      } catch (auditError) {
        console.error("[v0] Failed to create admin notification audit log:", auditError)
      }
    } else {
      console.error("[v0] Failed to send admin notification email:", emailResult.error)
      
      // Create audit log for failed notification
      try {
        await createAuditLog({
          eventId: input.eventId,
          actor: "ai",
          action: "ADMIN_NOTIFY_FAILED",
          reason: emailResult.error,
          notes: `Failed to send admin notification to ${adminEmail}`,
        })
      } catch (auditError) {
        console.error("[v0] Failed to create admin notification failure audit log:", auditError)
      }
    }
  } catch (error) {
    // This should never happen since sendSafeEmail doesn't throw, but just in case
    console.error("[v0] Unexpected error sending admin notification:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    try {
      await createAuditLog({
        eventId: input.eventId,
        actor: "ai",
        action: "ADMIN_NOTIFY_FAILED",
        reason: errorMessage,
        notes: `Unexpected error sending admin notification`,
      })
    } catch (auditError) {
      console.error("[v0] Failed to create admin notification error audit log:", auditError)
    }
  }
}
