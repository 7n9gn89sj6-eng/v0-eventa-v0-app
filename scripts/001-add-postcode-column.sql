-- Add postcode column to Event table
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "postcode" TEXT;

-- Add comment
COMMENT ON COLUMN "Event"."postcode" IS 'Postal/ZIP code for event location';
