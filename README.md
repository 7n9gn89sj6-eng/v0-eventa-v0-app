# Eventa v0

<!-- Deployment verification: 2025-11-13 13:57 UTC -->

A multilingual community events platform with AI-powered hybrid search.

## Features

- **Browse Events**: Anyone can search and browse events without login
- **AI Search**: Plain language, multilingual search with synonym expansion
- **Hybrid Search**: Local database + optional Google web search
- **Post Events**: Authenticated users can create events with geocoding
- **Multilingual**: UI in English, Italian, Greek, Spanish, and French
- **Filters**: Date, category, price, and distance-based filtering
- **Event Edit Links**: Users receive an edit link via email to update event details without logging in
- **AI Moderation**: Automatic content screening for harmful content and policy violations
- **Admin Dashboard**: Review and moderate flagged events with detailed analysis
- **Appeal System**: Users can appeal rejected events for admin review
- **Audit Logging**: Complete transparency with detailed action history
- **Rate Limiting**: Spam prevention with 5 events per hour limit
- **Calendar Export**: Download events as .ics files for Google/Apple/Outlook calendars

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Search**: pgvector (semantic) + pg_trgm (keyword)
- **Auth**: NextAuth with email magic links
- **UI**: Tailwind CSS + shadcn/ui
- **Maps**: Mapbox
- **Web Search**: Google Programmable Search Engine
- **i18n**: next-intl
- **AI**: Vercel AI SDK with OpenAI
- **Rate Limiting**: Upstash Redis

## Getting Started

### 1. Install dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Set up environment variables

Copy the example environment file and configure it:

\`\`\`bash
cp .env.example .env
\`\`\`

**Required Environment Variables:**

#### Database (Required)
- `NEON_DATABASE_URL`: PostgreSQL connection string from Neon
  - Get from: https://neon.tech

#### Authentication Feature Flag (Required)
- `NEXT_PUBLIC_AUTH_ENABLED`: Set to `"true"` to enable authentication, `"false"` to disable
  - **Default**: `"false"` (authentication disabled)
  - **When to enable**: After configuring all email service variables below
  - **Note**: The app works in browse-only mode when disabled

#### NextAuth (Required only when NEXT_PUBLIC_AUTH_ENABLED="true")
- `NEXTAUTH_URL`: Your app URL (e.g., `https://yourdomain.com` or `http://localhost:3000` for dev)
- `NEXTAUTH_SECRET`: Secret key for NextAuth (generate with: `openssl rand -base64 32`)
- `EMAIL_SERVER_HOST`: SMTP host - Set to `smtp.resend.com` for Resend
- `EMAIL_SERVER_PORT`: SMTP port - Set to `465` for Resend (secure)
- `EMAIL_SERVER_USER`: SMTP username - Set to `resend` for Resend
- `EMAIL_SERVER_PASSWORD`: SMTP password/API key - Your Resend API key (starts with `re_`)
- `EMAIL_FROM`: Sender email address (e.g., `onboarding@resend.dev` for testing, or `noreply@yourdomain.com` for production)
- `SMTP_FROM`: Same as EMAIL_FROM
- `ADMIN_NOTIFICATION_EMAIL`: Admin email to receive event moderation notifications

**Recommended Email Provider: Resend**
1. Sign up at https://resend.com (free tier: 3,000 emails/month)
2. Get your API key from the dashboard
3. Use these settings:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: Your Resend API key (starts with `re_`)
4. For development/testing: Use `onboarding@resend.dev` as the from address (no domain verification needed)
5. For production: Verify your own domain in Resend dashboard for better deliverability
6. **Set `NEXT_PUBLIC_AUTH_ENABLED="true"`** to enable authentication

#### AI Moderation (Required for Phase 2)
- `OPENAI_API_KEY`: OpenAI API key for AI-powered content moderation
  - Get from: https://platform.openai.com/api-keys
  - Used for: Automatic event screening, harmful content detection

#### Web Search (Optional but Recommended)
- `GOOGLE_API_KEY`: Google API key for Custom Search API
  - Get from: https://console.cloud.google.com/apis/credentials
  - Enable "Custom Search API" in Google Cloud Console
- `GOOGLE_PSE_ID`: Google Programmable Search Engine ID (also called Custom Search Engine ID)
  - **How to get it:**
    1. Go to https://programmablesearchengine.google.com/
    2. Click "Add" to create a new search engine
    3. In "Sites to search", enter `*` (asterisk) to search the entire web
    4. Give it a name (e.g., "Eventa Web Search")
    5. Click "Create"
    6. Go to "Setup" → "Basics"
    7. Copy the "Search engine ID" (looks like: `017576662512468239146:omuauf_lfve`)
    8. Add it to your `.env` file as `GOOGLE_PSE_ID`
  - **Note**: Free tier allows 100 searches per day. For production, consider upgrading.

#### Redis (Required for Rate Limiting)
- `UPSTASH_KV_KV_REST_API_URL`: Upstash Redis REST API URL
- `UPSTASH_KV_KV_REST_API_TOKEN`: Upstash Redis REST API token
  - Get from: https://upstash.com
  - Used for: Rate limiting event submissions (5 per hour per user)

### 3. Set up database

**Local Development:**

\`\`\`bash
# Run migrations
npm run db:migrate:dev

# Or push schema changes without migrations
npm run db:push

# Execute SQL scripts for pgvector and search indexes
npx prisma db execute --file scripts/01-enable-pgvector.sql
npx prisma db execute --file scripts/02-create-search-indexes.sql
npx prisma db execute --file scripts/03-add-moderation-fields.sql
npx prisma db execute --file scripts/04-add-audit-and-appeals.sql
npx prisma db execute --file scripts/03-seed-sample-events.sql
\`\`\`

**Production Deployment:**

\`\`\`bash
# Deploy pending migrations (non-interactive, safe for CI/CD)
npm run db:migrate:deploy

# Or use pnpm
pnpm prisma migrate deploy
\`\`\`

**Database Management:**

\`\`\`bash
# Open Prisma Studio to view/edit data
npm run db:studio
\`\`\`

### 4. Run development server

\`\`\`bash
npm run dev
\`\`\`

### 5. Open your browser

Visit [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

1. **Push to GitHub**: Push your code to a GitHub repository

2. **Import to Vercel**: Go to https://vercel.com and import your repository

3. **Configure Environment Variables**: In your Vercel project settings, add environment variables:
   - Go to Settings → Environment Variables (or use the Vars section in v0 sidebar)
   - **Required**: Add `NEON_DATABASE_URL` with your database connection string
   - **For authentication**: Add all Resend email service variables:
     - `EMAIL_SERVER_HOST="smtp.resend.com"`
     - `EMAIL_SERVER_PORT="465"`
     - `EMAIL_SERVER_USER="resend"`
     - `EMAIL_SERVER_PASSWORD="re_YourResendAPIKey"`
     - `EMAIL_FROM="onboarding@resend.dev"` (or your verified domain)
     - `SMTP_FROM="onboarding@resend.dev"` (same as EMAIL_FROM)
     - `ADMIN_NOTIFICATION_EMAIL="admin@yourdomain.com"`
     - Set `NEXT_PUBLIC_AUTH_ENABLED="true"`
   - **Optional**: Add Mapbox, Google PSE, and OpenAI keys for enhanced features
     - `OPENAI_API_KEY`: Required for `/api/search/intent` AI-powered intent extraction AND AI moderation
     - `UPSTASH_KV_KV_REST_API_URL` and `UPSTASH_KV_KV_REST_API_TOKEN`: Required for rate limiting

4. **Deploy**: Vercel will automatically deploy your app
   - The `postinstall` script will automatically run `prisma generate` and `prisma migrate deploy`
   - Migrations will be applied to your production database before each deployment

5. **Test Email Delivery**: After deployment, test that emails work in production:
   - Visit `https://yourdomain.com/api/test-email?email=your-email@example.com`
   - Check your inbox for the test email
   - If successful, authentication and notifications are ready to use

**Important Notes**:
- Migrations run automatically during Vercel deployments via the `postinstall` script
- The app works in **browse-only mode** by default (authentication disabled)
- To enable user sign-in and event posting:
  1. Configure all Resend email service environment variables
  2. Set `NEXT_PUBLIC_AUTH_ENABLED="true"` in Vercel environment variables
  3. Redeploy the app
  4. Test email delivery using the `/api/test-email` endpoint
- Users will see a disabled "Sign in" button when authentication is not configured
- Use Resend's free shared domain (`onboarding@resend.dev`) for testing before verifying your own domain

## Automated Event Maintenance

The app includes an automated cron job that runs hourly to maintain event data:

**What it does:**
- **Archives** published events that have ended (status changes from PUBLISHED to ARCHIVED)
- **Deletes** archived events older than 30 days (permanent removal)

**Setup on Vercel:**

1. The cron schedule is configured in `vercel.json` to run hourly
2. Add `CRON_SECRET` environment variable in Vercel project settings:
   \`\`\`bash
   # Generate a secure random secret
   openssl rand -base64 32
   \`\`\`
3. Vercel will automatically call the endpoint with proper authentication

**Setup on other hosts:**

For non-Vercel deployments, set up a cron job or scheduled task to call:

\`\`\`bash
curl -X GET https://yourdomain.com/api/cron/events-maintenance \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
\`\`\`

**Cron schedule examples:**
- Hourly: `0 * * * *` (recommended for timezone tolerance)
- Daily at 2 AM: `0 2 * * *`
- Every 6 hours: `0 */6 * * *`

**Security:**
- The endpoint requires `Authorization: Bearer ${CRON_SECRET}` header
- Returns 401 for unauthorized requests
- Never commit `CRON_SECRET` to version control

## Multilingual Support

The UI is available in 5 languages:
- English (en)
- Italian (it)
- Greek (el)
- Spanish (es)
- French (fr)

Users can switch languages using the globe icon in the header. The language preference is stored in a cookie.

**Note**: Event search accepts queries in any language. The AI detects the language and normalizes queries with synonym expansion (e.g., market/fiesta/festa/bazaar).

## Project Structure

\`\`\`
eventa-v0/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── events/            # Event pages
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── search/           # Search components
│   ├── events/           # Event components
│   └── auth/             # Auth components
├── lib/                   # Utilities
│   ├── db.ts             # Prisma client
│   ├── types.ts          # TypeScript types
│   └── search/           # Search utilities
├── i18n/                 # Internationalization
│   ├── messages/         # Translation files
│   └── request.ts        # i18n config
├── prisma/               # Database schema
└── scripts/              # SQL scripts
\`\`\`

## Database Schema

- **User**: Basic user info (email, name) + NextAuth tables
- **Event**: Full event details with geocoding, categories, pricing, images, moderation status, audit logs
- **Search**: Full-text search with pg_trgm + optional vector embeddings

## API Endpoints

### Public Endpoints
- `GET /api/events` - List/search events (only APPROVED events)
- `POST /api/events/submit` - Create event (rate limited: 5/hour)
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event (requires edit token, triggers re-moderation)
- `GET /api/events/:id/calendar` - Download event as .ics file
- `POST /api/events/:id/appeal` - Submit appeal for rejected event
- `POST /api/search` - AI-powered hybrid search
- `POST /api/auth/*` - NextAuth endpoints
- `GET /api/cron/events-maintenance` - Automated event maintenance
- `GET /api/status` - Health endpoint

### Admin Endpoints (Authentication Required)
- `GET /api/admin/events` - List all events with moderation details
- `GET /api/admin/events/:id` - Get event with audit logs and appeals
- `POST /api/admin/events/:id/moderate` - Approve or reject event
- `POST /api/admin/events/:id/appeal` - Respond to appeal
- `GET /api/admin/summary` - Get moderation statistics

## Phase 2: Moderation & Admin System

### Overview

Phase 2 adds comprehensive content moderation with AI-powered screening and human admin oversight to ensure event quality and safety.

### Key Features

**AI Moderation:**
- Automatic content analysis for all submitted events
- Detects harmful content: grooming, hate gatherings, exploitation, criminal activity, extremism
- Three-tier decision system: APPROVED, FLAGGED (needs review), REJECTED
- Severity levels: low, medium, high, critical

**Admin Dashboard:**
- View all events with moderation status filters
- Detailed event review pages with AI analysis
- Approve or reject events with custom reasons
- Review and respond to user appeals
- Complete audit history for each event

**Appeal Workflow:**
- Users can appeal rejected events
- Admins receive email notifications of appeals
- Admins can approve or reject appeals with notes
- Users receive email notifications of appeal decisions

**Audit Logging:**
- Complete transparency of all moderation actions
- Tracks event creation, edits, AI decisions, admin actions, appeals
- Searchable history with timestamps and actors
- Metadata storage for AI analysis results

**Rate Limiting:**
- 5 event submissions per hour per email address
- Prevents spam and abuse
- Uses Upstash Redis for distributed rate limiting

**Enhanced Calendar Export:**
- Improved .ics file format with proper timezone support
- Compatible with Google Calendar, Apple Calendar, Outlook
- Includes organizer information and event URLs

### Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Moderation Workflow](./docs/moderation-workflow.md)** - Complete moderation process, status states, notification flows
- **[Database Schema](./docs/database-schema.md)** - Database models, fields, relationships, indexes
- **[API Endpoints](./docs/api-endpoints.md)** - All API routes with request/response examples
- **[Testing](./docs/testing.md)** - Testing strategy, test cases, edge cases
- **[Audit Logs](./docs/audit-logs.md)** - Audit log system, action types, usage examples

### Admin Access

To access the admin dashboard:

1. Navigate to `/admin/events`
2. Sign in with admin credentials (requires authentication enabled)
3. View and moderate events

**Production Setup**

Grant admin access via database:

\`\`\`sql
UPDATE "User" 
SET "isAdmin" = true 
WHERE email = 'admin@example.com';
\`\`\`

**Where to run this:**
- Neon Dashboard → SQL Editor
- Or via `psql` with your database connection string

### Testing

Phase 2 includes comprehensive automated tests using Playwright:

\`\`\`bash
# Run all tests
npm test

# Run specific test suite
npm test tests/moderation.spec.ts
npm test tests/appeal-workflow.spec.ts
npm test tests/rate-limiting.spec.ts
npm test tests/calendar-export.spec.ts

# Run tests in headed mode (see browser)
npm test -- --headed

# Generate test report
npm test -- --reporter=html
\`\`\`

### Event Visibility Rules

Events are only shown publicly when BOTH conditions are met:
- Event status: `PUBLISHED` (user-controlled)
- Moderation status: `APPROVED` (system-controlled)

Events with status `PENDING`, `FLAGGED`, or `REJECTED` are hidden from public view.

### Moderation Flow

1. **User submits event** → Status: PENDING
2. **Verification email sent** → User receives edit link
3. **AI moderation runs** → Analyzes content automatically
4. **AI decision**:
   - APPROVED → Event becomes public
   - FLAGGED → Admin receives notification for review
   - REJECTED → Creator receives notification with reason
5. **Admin review** (for flagged events):
   - Admin approves → Event becomes public
   - Admin rejects → Creator receives notification
6. **Appeal process** (for rejected events):
   - Creator submits appeal → Admin receives notification
   - Admin reviews appeal → Creator receives decision

### Migration from Phase 1

If upgrading from Phase 1:

1. Run the new migration scripts:
   \`\`\`bash
   npx prisma db execute --file scripts/03-add-moderation-fields.sql
   npx prisma db execute --file scripts/04-add-audit-and-appeals.sql
   \`\`\`

2. Add required environment variables:
   - `OPENAI_API_KEY` for AI moderation
   - `UPSTASH_KV_KV_REST_API_URL` and `UPSTASH_KV_KV_REST_API_TOKEN` for rate limiting

3. Existing events will have `moderationStatus: PENDING` by default
4. Run a one-time script to approve existing events (optional):
   \`\`\`bash
   npm run scripts:approve-existing-events
   \`\`\`

## License

MIT

Deployment test: 2025-11-13 14:15:00 UTC
