/**
 * Runtime guard for missing database columns
 * Temporary safety mechanism until migrations are applied
 */

import { Prisma } from "@prisma/client"

// Process-level flag to log missing column warning only once
let missingLanguageColumnWarned = false

/**
 * Check if an error is related to a missing Event.language column
 */
function isMissingLanguageColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  
  const errorMessage = error.message || ""
  const errorString = error.toString()
  
  // Check for various forms of "column does not exist" errors
  const missingColumnPatterns = [
    "Event.language",
    "does not exist",
    "column.*language.*does not exist",
    "Unknown column.*language",
  ]
  
  const combinedText = `${errorMessage} ${errorString}`.toLowerCase()
  
  return missingColumnPatterns.some(pattern => {
    const regex = new RegExp(pattern.toLowerCase().replace(/\*/g, ".*"))
    return regex.test(combinedText)
  })
}

/**
 * Wraps a Prisma query and handles missing language column gracefully
 * This is a temporary runtime guard until migrations are applied
 * 
 * If the query fails due to missing language column, it will:
 * 1. Log a warning (once per process)
 * 2. Re-throw the error (caller should handle gracefully)
 * 
 * Note: The caller is responsible for implementing fallback behavior
 */
export async function withLanguageColumnGuard<T>(
  queryFn: () => Promise<T>
): Promise<T> {
  try {
    return await queryFn()
  } catch (error) {
    if (isMissingLanguageColumnError(error)) {
      // Log warning once per process
      if (!missingLanguageColumnWarned) {
        console.warn(
          "[SEARCH FALLBACK] Event.language column missing — search running without language filter. " +
          "This is expected until the migration is applied. Migration: prisma/migrations/add_language_field"
        )
        missingLanguageColumnWarned = true
      }
      
      // Re-throw so caller can handle (or implement fallback)
      // The error will propagate, but we've logged the warning
      throw error
    }
    
    // If it's not a missing column error, rethrow
    throw error
  }
}

