/**
 * Embedding generation for semantic search
 * Uses OpenAI text-embedding-3-small model (1536 dimensions)
 */

import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generate embedding for searchable text
 * Combines title, description, venue, and categories into searchable content
 *
 * @param title - Event title
 * @param description - Event description
 * @param venueName - Optional venue name
 * @param categories - Optional categories array
 * @returns Embedding vector (1536 dimensions) or null if generation fails
 */
export async function generateEventEmbedding(
  title: string,
  description?: string | null,
  venueName?: string | null,
  categories?: string[] | null,
): Promise<number[] | null> {
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[embeddings] OPENAI_API_KEY not configured, skipping embedding generation")
    return null
  }

  try {
    // Build searchable text from event fields
    const searchableParts = [
      title,
      description || "",
      venueName || "",
      ...(categories || []),
    ].filter(Boolean)

    const searchableText = searchableParts.join(" ").trim()
    console.log("[embeddings] Generating embedding for event:", { 
      titlePreview: title.substring(0, 50),
      textLength: searchableText.length,
      hasDescription: !!description,
      hasVenue: !!venueName,
      categoriesCount: categories?.length || 0
    })

    // Skip if text is too short (likely not meaningful)
    if (searchableText.length < 10) {
      console.warn("[embeddings] Text too short for embedding generation:", { length: searchableText.length })
      return null
    }

    // Generate embedding using OpenAI
    console.log("[embeddings] Calling OpenAI embeddings API...")
    const startTime = Date.now()
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: searchableText,
    })
    const duration = Date.now() - startTime

    const embedding = response.data[0]?.embedding

    if (!embedding || embedding.length !== 1536) {
      console.error("[embeddings] Invalid embedding returned from OpenAI:", { 
        hasEmbedding: !!embedding,
        length: embedding?.length 
      })
      return null
    }

    console.log("[embeddings] ✓ Embedding generated successfully:", { 
      dimensions: embedding.length,
      durationMs: duration,
      titlePreview: title.substring(0, 50)
    })

    return embedding
  } catch (error) {
    console.error("[embeddings] Error generating embedding:", error)
    // Don't throw - embedding is optional, event creation should continue
    return null
  }
}

/**
 * Convert embedding array to PostgreSQL vector format string
 * PostgreSQL pgvector format: [0.1,0.2,0.3,...]
 *
 * @param embedding - Embedding vector array
 * @returns PostgreSQL vector string format
 */
export function embeddingToPGVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

/**
 * Check if embedding generation should be skipped
 * Useful for rate limiting or cost control
 *
 * @returns true if embedding generation should be skipped
 */
export function shouldSkipEmbedding(): boolean {
  // Can add feature flags or rate limiting here
  const skipEmbedding = process.env.SKIP_EMBEDDING_GENERATION === "true"
  return skipEmbedding
}

