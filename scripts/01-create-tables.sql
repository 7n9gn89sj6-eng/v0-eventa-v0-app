-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "isVerified" BOOLEAN DEFAULT false NOT NULL,
  "emailVerified" TIMESTAMP,
  "image" TEXT,
  "isAdmin" BOOLEAN DEFAULT false NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create Account table
CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE("provider", "providerAccountId")
);

-- Create Session table
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "sessionToken" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create VerificationToken table
CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "expires" TIMESTAMP NOT NULL,
  UNIQUE("identifier", "token")
);

-- Create EmailVerification table
CREATE TABLE IF NOT EXISTS "EmailVerification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "consumedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create Event table
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "startAt" TIMESTAMP NOT NULL,
  "endAt" TIMESTAMP NOT NULL,
  "locationAddress" TEXT,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "imageUrl" TEXT,
  "externalUrl" TEXT,
  "status" "EventStatus" DEFAULT 'DRAFT' NOT NULL,
  "categories" TEXT[] DEFAULT '{}' NOT NULL,
  "timezone" TEXT DEFAULT 'UTC' NOT NULL,
  "venueName" TEXT,
  "address" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "priceFree" BOOLEAN DEFAULT false NOT NULL,
  "priceAmount" INTEGER,
  "websiteUrl" TEXT,
  "languages" TEXT[] DEFAULT '{}' NOT NULL,
  "imageUrls" TEXT[] DEFAULT '{}' NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "searchText" TEXT NOT NULL DEFAULT '',
  "searchTextFolded" TEXT,
  "embedding" vector(1536),
  CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create EventEditToken table
CREATE TABLE IF NOT EXISTS "EventEditToken" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "tokenHash" TEXT UNIQUE NOT NULL,
  "expires" TIMESTAMP NOT NULL,
  "usedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "EventEditToken_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx" ON "EmailVerification"("userId");
CREATE INDEX IF NOT EXISTS "EmailVerification_email_idx" ON "EmailVerification"("email");
CREATE INDEX IF NOT EXISTS "Event_city_country_startAt_idx" ON "Event"("city", "country", "startAt");
CREATE INDEX IF NOT EXISTS "Event_startAt_idx" ON "Event"("startAt");
CREATE INDEX IF NOT EXISTS "Event_categories_idx" ON "Event"("categories");
CREATE INDEX IF NOT EXISTS "Event_lat_lng_idx" ON "Event"("lat", "lng");
CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status");
CREATE INDEX IF NOT EXISTS "EventEditToken_eventId_idx" ON "EventEditToken"("eventId");
CREATE INDEX IF NOT EXISTS "EventEditToken_tokenHash_idx" ON "EventEditToken"("tokenHash");
