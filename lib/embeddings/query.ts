/**
 * Generate embedding for search queries
 * Used for semantic search matching
 */

import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generate embedding for a search query
 * Uses the same model as event embeddings for compatibility
 *
 * @param query - User search query
 * @returns Embedding vector (1536 dimensions) or null if generation fails
 */
export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[embeddings] OPENAI_API_KEY not configured, skipping query embedding")
    return null
  }

  // Skip if query is too short
  if (!query || query.trim().length < 3) {
    console.log("[embeddings] Query too short for embedding:", { length: query?.length })
    return null
  }

  try {
    console.log("[embeddings] Generating query embedding:", { query: query.substring(0, 100) })
    const startTime = Date.now()
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query.trim(),
    })
    const duration = Date.now() - startTime

    const embedding = response.data[0]?.embedding

    if (!embedding || embedding.length !== 1536) {
      console.error("[embeddings] Invalid query embedding returned from OpenAI:", { 
        hasEmbedding: !!embedding,
        length: embedding?.length 
      })
      return null
    }

    console.log("[embeddings] ✓ Query embedding generated:", { 
      dimensions: embedding.length,
      durationMs: duration,
      queryPreview: query.substring(0, 50)
    })

    return embedding
  } catch (error) {
    console.error("[embeddings] Error generating query embedding:", error)
    return null
  }
}

/**
 * Convert embedding array to PostgreSQL vector format string
 * Same as in generate.ts, but useful to have here too
 *
 * @param embedding - Embedding vector array
 * @returns PostgreSQL vector string format
 */
export function embeddingToPGVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

