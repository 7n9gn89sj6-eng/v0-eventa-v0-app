-- Grant admin access to your email
UPDATE "User" 
SET "isAdmin" = true 
WHERE email = 'pana2112gnostatos@gmail.com';

-- Verify admin was granted
SELECT id, email, name, "isAdmin", "createdAt" 
FROM "User" 
WHERE email = 'pana2112gnostatos@gmail.com';
