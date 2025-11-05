"use server"

import { sql } from "@/lib/db"
import { hashToken } from "@/lib/crypto"
import { eventFormSchema, type EventFormData } from "@/lib/schemas/event"
import { revalidatePath } from "next/cache"

export async function validateTokenAndGetEvent(eventId: string, token: string) {
  try {
    const tokenHash = hashToken(token)

    // Check if token is valid
    const tokenResult = await sql`
      SELECT * FROM "EventEditToken"
      WHERE "eventId" = ${eventId}
      AND "tokenHash" = ${tokenHash}
      AND "expires" > NOW()
      AND "usedAt" IS NULL
      LIMIT 1
    `

    if (tokenResult.length === 0) {
      return { error: "Invalid or expired edit link" }
    }

    // Get event data
    const eventResult = await sql`
      SELECT * FROM "Event"
      WHERE id = ${eventId}
      LIMIT 1
    `

    if (eventResult.length === 0) {
      return { error: "Event not found" }
    }

    return { event: eventResult[0], tokenId: tokenResult[0].id }
  } catch (error) {
    console.error("[v0] Error validating token:", error)
    return { error: "Failed to validate edit link" }
  }
}

export async function updateEvent(eventId: string, token: string, data: EventFormData) {
  try {
    // Validate token first
    const validation = await validateTokenAndGetEvent(eventId, token)
    if (validation.error) {
      return { error: validation.error }
    }

    // Validate form data
    const validatedData = eventFormSchema.parse(data)

    // Update event
    await sql`
      UPDATE "Event"
      SET
        title = ${validatedData.title},
        description = ${validatedData.description},
        "startAt" = ${validatedData.startAt}::timestamp,
        "endAt" = ${validatedData.endAt ? `${validatedData.endAt}::timestamp` : null},
        "locationAddress" = ${validatedData.locationAddress || null},
        city = ${validatedData.city || null},
        country = ${validatedData.country || null},
        "venueName" = ${validatedData.venueName || null},
        "websiteUrl" = ${validatedData.websiteUrl || null},
        "externalUrl" = ${validatedData.externalUrl || null},
        "imageUrl" = ${validatedData.imageUrl || null},
        "priceFree" = ${validatedData.priceFree},
        "priceAmount" = ${validatedData.priceAmount || null},
        "updatedAt" = NOW()
      WHERE id = ${eventId}
    `

    // Mark token as used
    await sql`
      UPDATE "EventEditToken"
      SET "usedAt" = NOW()
      WHERE id = ${validation.tokenId}
    `

    revalidatePath(`/edit/${eventId}`)

    return { success: true }
  } catch (error) {
    console.error("[v0] Error updating event:", error)
    return { error: "Failed to update event" }
  }
}
