-- Add language field to Event table for detected language
-- Language is nullable for backward compatibility with existing events
-- Stores ISO 639-1 language codes: en, el, it, es, fr

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- Add index for language-based filtering (optional but useful for future language-aware search)
CREATE INDEX IF NOT EXISTS "Event_language_idx" ON "Event"("language");

-- Note: embedding field already exists, no migration needed

