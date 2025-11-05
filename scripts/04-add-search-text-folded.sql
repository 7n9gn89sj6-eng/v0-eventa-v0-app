-- Add search_text_folded column for accent-insensitive search
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS search_text_folded TEXT;

-- Create index on search_text_folded for better performance
CREATE INDEX IF NOT EXISTS "Event_search_text_folded_idx" ON "Event" USING gin(to_tsvector('simple', search_text_folded));
