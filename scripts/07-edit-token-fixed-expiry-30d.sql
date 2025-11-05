-- Migration: edit_token_fixed_expiry_30d
-- Description: Standardize edit token expiry to 30 days from creation
-- This migration updates existing tokens to use a fixed 30-day expiry

-- Update existing tokens that haven't expired yet
-- Set their expiry to 30 days from their creation date
UPDATE "EventEditToken"
SET "expires" = "createdAt" + INTERVAL '30 days'
WHERE "expires" > NOW();

-- Note: Expired tokens are left as-is and will be cleaned up by the cron job
-- New tokens will automatically use the 30-day expiry via the application code
