-- Add missing postcode column to Event table
ALTER TABLE "Event" 
ADD COLUMN IF NOT EXISTS "postcode" TEXT;
