-- Add isAdmin field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Optional: Make the first user an admin (useful for development)
-- UPDATE "User" SET "isAdmin" = true WHERE email = 'your-email@example.com';
