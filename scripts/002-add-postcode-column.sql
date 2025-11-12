-- Migration: Add postcode column to Event table
-- This fixes the Prisma error: "The column `Event.postcode` does not exist"

ALTER TABLE "Event" 
ADD COLUMN IF NOT EXISTS "postcode" TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS "Event_postcode_idx" ON "Event"("postcode");
