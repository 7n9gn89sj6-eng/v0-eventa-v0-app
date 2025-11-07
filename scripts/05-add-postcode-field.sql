-- Add postcode field to Event table
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "postcode" TEXT;

-- Add comment
COMMENT ON COLUMN "Event"."postcode" IS 'Postal code/ZIP code for the event location';
