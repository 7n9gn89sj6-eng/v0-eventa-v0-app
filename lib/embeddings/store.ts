/**
 * Helper functions for storing embeddings in PostgreSQL
 * Since Prisma doesn't fully support vector type, we use raw SQL
 */

import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

/**
 * Store embedding for an event using raw SQL
 * This is necessary because Prisma doesn't support the vector type directly
 *
 * @param eventId - Event ID
 * @param embedding - Embedding vector array (1536 dimensions)
 */
export async function storeEventEmbedding(
  eventId: string,
  embedding: number[],
): Promise<void> {
  console.log("[embeddings] Storing embedding for event:", { eventId, dimensions: embedding.length })

  if (embedding.length !== 1536) {
    console.error("[embeddings] Invalid embedding dimension:", { expected: 1536, got: embedding.length })
    throw new Error(`Invalid embedding dimension: expected 1536, got ${embedding.length}`)
  }

  try {
    // Convert embedding array to PostgreSQL vector format: [0.1,0.2,0.3,...]
    const vectorString = `[${embedding.join(",")}]`

    console.log("[embeddings] Executing SQL to store embedding...")
    const startTime = Date.now()
    // Use raw SQL to update the embedding field
    await db.$executeRawUnsafe(
      `UPDATE "Event" SET embedding = $1::vector WHERE id = $2`,
      vectorString,
      eventId,
    )
    const duration = Date.now() - startTime

    console.log("[embeddings] ✓ Embedding stored successfully:", { eventId, durationMs: duration })
  } catch (error) {
    console.error(`[embeddings] Error storing embedding for event ${eventId}:`, error)
    throw error
  }
}

/**
 * Get embedding for an event using raw SQL
 *
 * @param eventId - Event ID
 * @returns Embedding vector array or null if not found
 */
export async function getEventEmbedding(eventId: string): Promise<number[] | null> {
  try {
    const result = await db.$queryRawUnsafe<Array<{ embedding: string }>>(
      `SELECT embedding::text FROM "Event" WHERE id = $1 AND embedding IS NOT NULL`,
      eventId,
    )

    if (!result || result.length === 0 || !result[0].embedding) {
      return null
    }

    // Parse PostgreSQL vector format: [0.1,0.2,0.3,...]
    const vectorString = result[0].embedding
    const embedding = vectorString
      .slice(1, -1) // Remove brackets
      .split(",")
      .map(parseFloat)

    return embedding
  } catch (error) {
    console.error(`[embeddings] Error retrieving embedding for event ${eventId}:`, error)
    return null
  }
}

