-- Migration: event_created_by
-- Add createdById relation from Event to User (already exists in schema)
-- This migration is for documentation purposes as the schema already has this relation

-- Note: The Event.createdById and User.events relation already exist in the schema
-- This file documents the expected database structure

-- Verify the relation exists:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'Event' AND column_name = 'createdById';

-- If needed, you can add the column with:
-- ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
-- ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" 
--   FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE;

-- Create index for performance:
CREATE INDEX IF NOT EXISTS "Event_createdById_idx" ON "Event"("createdById");
