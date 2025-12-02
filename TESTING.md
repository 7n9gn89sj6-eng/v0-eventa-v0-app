# Testing & Verification Checklist

This document outlines the complete testing and verification process for the Eventa v0 app after making changes.

## Prerequisites

Ensure you have all required environment variables set up. Copy `.env.example` to `.env` and fill in the values:

\`\`\`bash
cp .env.example .env
\`\`\`

Required variables:
- `NEON_DATABASE_URL` - Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret for JWT signing
- `EMAIL_SERVER_*` - Email configuration for verification emails

Optional but recommended:
- `UPSTASH_KV_REST_API_URL` & `UPSTASH_KV_REST_API_TOKEN` - For rate limiting
- `OPENAI_API_KEY` - For AI-powered search intent extraction
- `GOOGLE_API_KEY` & `GOOGLE_PSE_ID` - For web search functionality

## Step 1: Database Setup

Generate Prisma client and run migrations:

\`\`\`bash
pnpm prisma generate
pnpm db:migrate:deploy  # Production
# OR
pnpm db:push  # Development (faster, no migration files)
\`\`\`

**Verify:**
- No errors during Prisma generation
- Database schema matches `prisma/schema.prisma`
- All tables created successfully

## Step 2: Install Dependencies

Clean install to ensure `tw-animate-css` is removed:

\`\`\`bash
rm -rf node_modules package-lock.json pnpm-lock.yaml
pnpm install
\`\`\`

**Verify:**
- `tw-animate-css` is NOT in `node_modules`
- All other dependencies installed successfully

## Step 3: Lint & Type Check

Run linting and TypeScript checks:

\`\`\`bash
pnpm lint
pnpm typecheck
\`\`\`

**Expected Results:**
- No linting errors
- No TypeScript compilation errors
- All imports resolve correctly

## Step 4: Unit Tests

Run unit tests with Vitest:

\`\`\`bash
pnpm test:unit
\`\`\`

**Tests to verify:**
- `tests/date-parser.test.ts` - Melbourne timezone handling with DST
- `tests/search.normalize.test.ts` - Search normalization logic

**Expected Results:**
- All tests pass
- DST boundary tests pass (October/April transitions)
- No timezone-related failures

## Step 5: E2E Tests

Install Playwright browsers (first time only):

\`\`\`bash
pnpm exec playwright install
\`\`\`

Run end-to-end tests:

\`\`\`bash
pnpm test:e2e
# OR for interactive mode:
pnpm test:e2e:ui
\`\`\`

**Tests to verify:**
- `tests/smoke.spec.ts` - Basic smoke tests

**Expected Results:**
- All E2E tests pass
- No browser console errors

## Step 6: Local Development Server

Start the development server:

\`\`\`bash
pnpm dev
\`\`\`

Visit `http://localhost:3000` and verify the following:

### 6.1 Status Endpoints

**`/api/status`** - Should show:
\`\`\`json
{
  "ok": true,
  "database": true,
  "upstash": true/false,
  "openai": { "configured": true/false }
}
\`\`\`

**`/api/health/env`** (Development only):
- Should list missing/optional environment variables
- Should be gated in production (returns `{ ok: true }` only)

### 6.2 Authentication Flow

1. Click "Sign in" button on landing page
   - Should have `data-testid="landing-signin"`
   - Should redirect to NextAuth email sign-in page
   
2. Enter email and submit
   - Should send verification email
   - Should redirect to verification page

3. Click verification link in email
   - Should authenticate user
   - Should redirect to `/add-event` (canonical route)

4. Verify `/events/new` redirects to `/add-event`

### 6.3 Event Creation Flow

1. Navigate to `/add-event`
   - Form should load without errors
   - All fields should be present

2. Fill out event form:
   - Title, description, location
   - Start and end dates (test DST boundaries if possible)
   - Verify end date must be after start date

3. Submit event
   - Should validate dates correctly
   - Should handle Melbourne timezone properly
   - Should create event in database

### 6.4 Search Functionality

1. **Database Search** (`/api/search/events`)
   - Search for existing events
   - Should return results from database

2. **Web Search** (`/api/search/external`)
   - Requires `GOOGLE_API_KEY`
   - Should return external event results

3. **Intent Extraction** (`/api/search/intent`)
   - Requires `OPENAI_API_KEY`
   - Should extract search intent from natural language

### 6.5 Environment Variable Standardization

Verify the following standardizations:

**Upstash:**
- Primary: `UPSTASH_KV_REST_API_URL`, `UPSTASH_KV_REST_API_TOKEN`
- Legacy fallbacks work if needed

**Database:**
- Primary: `NEON_DATABASE_URL`
- Fallback to `DATABASE_URL` in scripts

**OpenAI:**
- `OPENAI_API_KEY` exposed in status endpoint

## Step 7: Production Build

Build for production:

\`\`\`bash
pnpm build
\`\`\`

**Verify:**
- Build completes without errors
- No `tw-animate-css` import errors
- All pages compile successfully
- No TypeScript errors

Start production server:

\`\`\`bash
pnpm start
\`\`\`

**Verify:**
- App runs in production mode
- `/api/health/env` returns only `{ ok: true }` (no env details leaked)
- All features work as expected

## Step 8: Manual Verification Checklist

- [ ] Sign-in button works and redirects to `/add-event`
- [ ] Email verification flow completes successfully
- [ ] Event creation form validates dates correctly
- [ ] Melbourne timezone handles DST properly (test with dates in Oct/Apr)
- [ ] `/events/new` redirects to `/add-event`
- [ ] Search returns results (database + web if configured)
- [ ] Status endpoint shows correct integration status
- [ ] Health endpoint is gated in production
- [ ] No console errors in browser
- [ ] No build errors or warnings
- [ ] All environment variables standardized

## Troubleshooting

### Build Fails with tw-animate-css Error
- Ensure `tw-animate-css` is removed from `package.json`
- Ensure `@import "tw-animate-css";` is removed from `app/globals.css`
- Run `rm -rf node_modules && pnpm install`

### Database Connection Errors
- Verify `NEON_DATABASE_URL` is set correctly
- Run `pnpm db:push` to sync schema
- Check Neon dashboard for connection issues

### Authentication Not Working
- Verify `NEXTAUTH_SECRET` is set
- Check email server configuration
- Verify SessionProvider is in `app/layout.tsx`

### Timezone Issues
- Check `lib/date-parser.ts` uses Luxon with `Australia/Melbourne`
- Run unit tests: `pnpm test:unit`
- Test with dates around DST boundaries (early October, early April)

### Rate Limiting Not Working
- Verify Upstash environment variables are set
- Check `/api/status` shows `upstash: true`
- Upstash is optional - app works without it

## CI/CD Integration

For continuous integration, use:

\`\`\`bash
pnpm build:ci
\`\`\`

This runs:
1. `next build`
2. `pnpm typecheck`
3. `pnpm lint`

Add to your CI pipeline:
\`\`\`yaml
- run: pnpm install
- run: pnpm prisma generate
- run: pnpm build:ci
- run: pnpm test:unit
- run: pnpm test:e2e
\`\`\`

## Summary of Recent Changes

All segments from the cleanup process have been implemented:

1. ✅ Removed `tw-animate-css` dependency
2. ✅ Standardized Upstash env vars (`UPSTASH_KV_REST_API_*`)
3. ✅ Aligned DB env naming (`NEON_DATABASE_URL`)
4. ✅ Exposed `OPENAI_API_KEY` in status/health endpoints
5. ✅ Fixed Melbourne timezone handling (removed UTC+11 hardcode)
6. ✅ Protected health/env endpoint in production
7. ✅ Updated `.env.example` with all variables
8. ✅ Canonicalized event creation route (`/add-event`)
9. ✅ Sign-in flow redirects to `/add-event`
10. ✅ Created comprehensive testing checklist

The app is now production-ready with proper environment variable management, timezone handling, and security measures in place.
