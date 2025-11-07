-- Add Phase 3 plain-language event creation fields

-- Add event category enum
CREATE TYPE "EventCategory" AS ENUM (
  'ARTS_CULTURE',
  'MUSIC_NIGHTLIFE',
  'FOOD_DRINK',
  'FAMILY_KIDS',
  'SPORTS_OUTDOORS',
  'COMMUNITY_CAUSES',
  'LEARNING_TALKS',
  'MARKETS_FAIRS',
  'ONLINE_VIRTUAL'
);

-- Add new columns to Event table
ALTER TABLE "Event" 
ADD COLUMN "sourceText" TEXT,
ADD COLUMN "category" "EventCategory",
ADD COLUMN "tags" TEXT[] DEFAULT '{}',
ADD COLUMN "extractionConfidence" JSONB,
ADD COLUMN "organizerName" TEXT,
ADD COLUMN "organizerContact" TEXT;

-- Create index on category for filtering
CREATE INDEX "Event_category_idx" ON "Event"("category");

-- Backfill existing events with default tags array if needed
UPDATE "Event" SET "tags" = '{}' WHERE "tags" IS NULL;
