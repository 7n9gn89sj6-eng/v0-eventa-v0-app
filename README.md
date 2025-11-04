# Eventa v0

A multilingual community events platform with AI-powered hybrid search.

## Features

- **Browse Events**: Anyone can search and browse events without login
- **AI Search**: Plain language, multilingual search with synonym expansion
- **Hybrid Search**: Local database + optional Google web search
- **Post Events**: Authenticated users can create events with geocoding
- **Multilingual**: UI in English, Italian, Greek, Spanish, and French
- **Filters**: Date, category, price, and distance-based filtering
- **Event Edit Links**: Users receive an edit link via email to update event details without logging in

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
- `EMAIL_SERVER_HOST`: SMTP host (e.g., `smtp.resend.com`)
- `EMAIL_SERVER_PORT`: SMTP port (usually `587`)
- `EMAIL_SERVER_USER`: SMTP username
- `EMAIL_SERVER_PASSWORD`: SMTP password/API key
- `EMAIL_FROM`: Sender email address (e.g., `noreply@yourdomain.com`)

**Recommended Email Provider: Resend**
1. Sign up at https://resend.com
2. Get your API key
3. Use these settings:
   - Host: `smtp.resend.com`
   - Port: `587`
   - User: `resend`
   - Password: Your Resend API key
4. **Set `NEXT_PUBLIC_AUTH_ENABLED="true"`** to enable authentication

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
   - **For authentication**: Add all email service variables AND set `NEXT_PUBLIC_AUTH_ENABLED="true"`
   - **Optional**: Add Mapbox, Google PSE, and OpenAI keys for enhanced features
     - `OPENAI_API_KEY`: Required for `/api/search/intent` AI-powered intent extraction

4. **Deploy**: Vercel will automatically deploy your app
   - The `postinstall` script will automatically run `prisma generate` and `prisma migrate deploy`
   - Migrations will be applied to your production database before each deployment

**Important Notes**:
- Migrations run automatically during Vercel deployments via the `postinstall` script
- The app works in **browse-only mode** by default (authentication disabled)
- To enable user sign-in and event posting:
  1. Configure all email service environment variables
  2. Set `NEXT_PUBLIC_AUTH_ENABLED="true"` in Vercel environment variables
  3. Redeploy the app
- Users will see a disabled "Sign in" button when authentication is not configured

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
- **Event**: Full event details with geocoding, categories, pricing, images
- **Search**: Full-text search with pg_trgm + optional vector embeddings

## API Endpoints

- `GET /api/events` - List/search events
- `POST /api/events` - Create event (auth required)
- `GET /api/events/:id` - Get event details
- `POST /api/search` - AI-powered hybrid search
- `POST /api/auth/*` - NextAuth endpoints
- `GET /api/cron/events-maintenance` - Automated event maintenance
- `POST /api/events/:id/edit` - Update event details using edit link

## Search Flow

1. User enters query in any language
2. AI detects language (en/it/el/es/fr) - requires `OPENAI_API_KEY` for `/api/search/intent`
3. Query is normalized with synonym expansion
4. Database search with full-text + vector similarity
5. If < 6 results, automatically search Google PSE
6. Results are merged and deduplicated
7. Display with source badges (Eventa vs Web)

## License

MIT
