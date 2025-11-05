"use server"

import { sql } from "@/lib/db"
import { eventFormSchema, type EventFormData } from "@/lib/schemas/event"
import { createEditTokenForEvent, sendEditLinkEmail } from "@/lib/email"
import { randomBytes } from "crypto"

export async function createEvent(data: EventFormData, email: string) {
  try {
    console.log("[v0] Creating event with data:", { title: data.title, email })

    // Validate form data
    const validatedData = eventFormSchema.parse(data)

    // Generate event ID
    const eventId = randomBytes(16).toString("hex")

    console.log("[v0] Generated event ID:", eventId)

    // Create event in database
    await sql`
      INSERT INTO "Event" (
        id,
        title,
        description,
        "startAt",
        "endAt",
        "locationAddress",
        city,
        country,
        "venueName",
        "websiteUrl",
        "externalUrl",
        "imageUrl",
        "priceFree",
        "priceAmount",
        "ownerEmail",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${eventId},
        ${validatedData.title},
        ${validatedData.description},
        ${validatedData.startAt}::timestamp,
        ${validatedData.endAt ? `${validatedData.endAt}::timestamp` : null},
        ${validatedData.locationAddress || null},
        ${validatedData.city || null},
        ${validatedData.country || null},
        ${validatedData.venueName || null},
        ${validatedData.websiteUrl || null},
        ${validatedData.externalUrl || null},
        ${validatedData.imageUrl || null},
        ${validatedData.priceFree},
        ${validatedData.priceAmount || null},
        ${email},
        NOW(),
        NOW()
      )
    `

    console.log("[v0] Event created successfully")

    // Generate edit token
    const token = await createEditTokenForEvent(eventId)

    console.log("[v0] Edit token generated")

    // Send email with magic link
    const emailResult = await sendEditLinkEmail(email, validatedData.title, eventId, token)

    console.log("[v0] Email send result:", emailResult)

    if (!emailResult.success) {
      return { error: "Event created but failed to send email. Please contact support." }
    }

    return { success: true, eventId }
  } catch (error) {
    console.error("[v0] Error creating event:", error)
    return { error: "Failed to create event. Please try again." }
  }
}
