# Beta Testing Checklist - Eventa v0

**Date:** 2025-01-XX  
**Status:** Pre-Beta Review

## 🎯 Quick Status Summary

✅ **Overall Readiness:** 85-90% - Ready for Beta  
✅ **Core Features:** Complete  
✅ **Security:** Good  
⚠️ **Testing:** Basic coverage  
⚠️ **Monitoring:** Basic setup needed

---

## 🎯 Beta Testing Philosophy

**Eventa's Core Values:**
- **Plain-Language Forgiveness**: Results should feel reasonable, not perfect
- **First Language Support**: Users should search in their own language
- **Admin-Light**: Minimal admin overhead, maximum user trust
- **Semantic Freshness**: Edited events must stay searchable and relevant

**Beta Success Criteria:**
- Users feel understood, not judged
- Search results feel reasonable even when imperfect
- System degrades gracefully when services fail
- Language detection builds trust, not confusion

**What We're Testing:**
- Human understanding, not just technical correctness
- Language trust, not just language detection
- Forgiveness, not perfection
- Learning, not polish

---

## ✅ Pre-Beta Setup Checklist

### Priority Order (Re-ordered for Eventa Philosophy):

1. **Edit-Flow Semantic Freshness** (CRITICAL - User-Visible Correctness)
2. **Plain-Language Search Reasonableness** (CRITICAL - Core Experience)
3. **Environment + Database Verification** (CRITICAL - Infrastructure)
4. **Admin Access + Email** (CRITICAL - Operations)

### 1. Environment Variables (CRITICAL)

Verify all required environment variables are set in production:

#### Required:
- [ ] `DATABASE_URL` or `NEON_DATABASE_URL` - PostgreSQL connection
- [ ] `NEXTAUTH_SECRET` - JWT signing secret
- [ ] `NEXTAUTH_URL` - Application URL
- [ ] `RESEND_API_KEY` - Email delivery (Resend)
- [ ] `OPENAI_API_KEY` - AI moderation & search intent

#### Optional but Recommended:
- [ ] `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` - Rate limiting
- [ ] `GOOGLE_API_KEY` & `GOOGLE_PSE_ID` - Web search integration

**Verification:** Test `/api/status` endpoint to verify all integrations

### 2. Database Setup (CRITICAL)

- [ ] Run `npx prisma migrate deploy` in production
- [ ] Verify all tables exist:
  - [ ] `User`
  - [ ] `Event`
  - [ ] `EventEditToken`
  - [ ] `EmailVerification`
  - [ ] `EventAppeal`
  - [ ] `AuditLog`
  - [ ] `Favorite`
- [ ] Verify `pgvector` extension is enabled
- [ ] Verify `pg_trgm` extension is enabled
- [ ] Check that `language` and `embedding` columns exist on `Event` table
- [ ] Verify indexes are created (especially `event_embedding_idx`)

**SQL Check:**
```sql
-- Check extensions
SELECT * FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');

-- Check Event table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Event' 
AND column_name IN ('language', 'embedding');

-- Check embedding index
SELECT indexname FROM pg_indexes 
WHERE tablename = 'Event' 
AND indexname LIKE '%embedding%';
```

### 3. Admin User Setup (CRITICAL)

- [ ] Create at least one admin user:
```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'admin@yourdomain.com';
```

- [ ] Test admin login flow
- [ ] Verify admin can access `/admin/events`
- [ ] Verify admin can moderate events

### 4. Email Configuration (CRITICAL)

- [ ] Verify Resend domain is configured OR use `onboarding@resend.dev` for testing
- [ ] Test event submission email delivery
- [ ] Test edit link email delivery
- [ ] Test admin notification emails
- [ ] Verify email links work correctly

---

## 🧪 Functional Testing Checklist

### Core User Flows

#### 0. Edit-Flow Semantic Freshness (CRITICAL - User-Visible Correctness)

**Rationale:** An edited event is a new expression. Language + embeddings must stay fresh. This is user-visible correctness, not internal hygiene.

- [ ] **Edit Event Title/Description:**
  - [ ] User edits event title from "Jazz Night" to "Live Jazz Performance"
  - [ ] User edits event description
  - [ ] **Verify language re-detection occurred** (check logs: `[events/update] Language detection`)
  - [ ] **Verify embedding regenerated** (check logs: `[events/update] Embedding generated`)
  - [ ] **Verify event search relevance reflects changes:**
    - [ ] Search for "live jazz" → edited event appears
    - [ ] Search for old title "Jazz Night" → may still appear (forgiving)
    - [ ] Search for new description keywords → event ranks appropriately
  - [ ] Event saves successfully even if language/embedding regeneration fails
  - [ ] No user-visible errors during edit process

**Test Cases:**
- Edit title only → language/embedding regenerate
- Edit description only → language/embedding regenerate
- Edit both → language/embedding regenerate
- Edit with service failures → event still saves, logs show degraded mode

**Success Criteria:**
- ✅ Edited events remain semantically searchable
- ✅ Search results reflect new content, not stale content
- ✅ System fails gracefully if regeneration fails

#### 1. Event Submission Flow
- [ ] User can submit event via `/api/events/submit`
- [ ] Form validation works (title, dates, location)
- [ ] Email verification is sent
- [ ] Event is created with status `DRAFT` and `aiStatus` `PENDING`
- [ ] Language detection runs (check logs for `[submit] Language detection`)
- [ ] Embedding generation runs (check logs for `[submit] Embedding generated`)
- [ ] Event saves even if language/embedding generation fails
- [ ] Rate limiting works (test with 6+ submissions in 1 hour)

#### 2. Event Editing Flow
- [ ] User receives edit link in email
- [ ] Edit link works (`/events/[id]/edit?token=...`)
- [ ] User can update title and description
- [ ] Language is re-detected when title/description changes
- [ ] Embedding is regenerated when title/description changes
- [ ] Event saves even if language/embedding regeneration fails
- [ ] Edit token expires correctly

#### 3. Plain-Language Search Functionality (CRITICAL - Core Experience)

**Rationale:** Eventa's success depends less on perfect relevance and more on whether results feel reasonable and forgiving when users type naturally.

**Plain-Language Forgiveness Tests:**
- [ ] **"something fun tonight"**
  - [ ] Returns results (even if not perfect)
  - [ ] Results feel reasonable
  - [ ] System doesn't feel judgmental
  - [ ] User feels understood, not corrected

- [ ] **"food near me"**
  - [ ] Returns food-related events
  - [ ] Results feel relevant
  - [ ] No "no results" for reasonable queries
  - [ ] System is forgiving of casual language

- [ ] **"kids stuff Sunday"**
  - [ ] Returns family/kids events
  - [ ] Filters to Sunday (or nearby)
  - [ ] Results feel appropriate
  - [ ] System handles informal phrasing

- [ ] **"music things"**
  - [ ] Returns music-related events
  - [ ] Results feel reasonable
  - [ ] System is flexible with vague queries
  - [ ] User doesn't feel judged for casual language

**Test Questions to Record:**
- [ ] Did results feel reasonable, even if not perfect?
- [ ] Were results surprising in a good way?
- [ ] Did the system feel judgmental or flexible?
- [ ] Would you try another search, or did you feel discouraged?

**Technical Search Tests:**
- [ ] Basic search works (`/api/search/events?query=...`)
- [ ] Natural language search works (`/api/search/intent`)
- [ ] Multilingual search works (test with Greek, Italian, Spanish, French)
- [ ] Location disambiguation works:
  - [ ] "Ithaki, Greece" returns Greek island results (not Ithaca, NY)
  - [ ] "Naples, Italy" returns Italian city results (not Naples, FL)
- [ ] Date filtering works:
  - [ ] "April 2026" filters correctly
  - [ ] "next weekend" parses correctly
  - [ ] Date ranges work
- [ ] Hybrid search works (database + web results)
- [ ] Semantic search works (if embeddings are generated)
- [ ] Search returns results even if embeddings are missing

**Success Criteria:**
- ✅ Plain-language queries return reasonable results
- ✅ System feels forgiving, not strict
- ✅ Users feel understood, not corrected
- ✅ Imperfect results are acceptable if they feel reasonable

#### 4. Admin Moderation Flow
- [ ] Admin can view events needing review (`/admin/events?tab=needs-review`)
- [ ] Admin can see language and embedding status in event detail view
- [ ] Admin can approve events
- [ ] Admin can reject events
- [ ] Admin can add notes
- [ ] Audit logs are created
- [ ] Email notifications are sent

#### 5. Event Display
- [ ] Published events appear in public listings
- [ ] Event images display correctly
- [ ] Calendar export works (`.ics` file)
- [ ] Event details page loads correctly
- [ ] External search results display images

---

## 🔒 Security Testing

### Authentication & Authorization
- [ ] Admin routes require authentication (`/admin/*`)
- [ ] Edit tokens expire correctly
- [ ] Invalid edit tokens are rejected
- [ ] Rate limiting prevents abuse
- [ ] SQL injection protection works (test with malicious search queries)

### Input Validation
- [ ] XSS protection (test with `<script>` tags in event titles)
- [ ] SQL injection protection (test with `'; DROP TABLE--` in search)
- [ ] Email validation works
- [ ] Date validation works (end date after start date)
- [ ] URL validation works

### Data Protection
- [ ] Sensitive data not exposed in API responses
- [ ] Environment variables not exposed in client-side code
- [ ] Health endpoint gated in production (`/api/health/env`)

---

## 🚀 Performance Testing

### API Response Times
- [ ] Search API responds in < 2 seconds
- [ ] Event submission completes in < 5 seconds
- [ ] Admin dashboard loads in < 3 seconds
- [ ] Event detail page loads in < 1 second

### Database Performance
- [ ] Search queries use indexes
- [ ] No N+1 query problems
- [ ] Embedding queries don't timeout
- [ ] Full-text search is fast

### Error Handling
- [ ] Graceful degradation when OpenAI API fails
- [ ] Graceful degradation when Google Search API fails
- [ ] Graceful degradation when Redis (rate limiting) fails
- [ ] Error messages are user-friendly
- [ ] Errors are logged appropriately

---

## 🌍 Multilingual Testing

### UI Translations
- [ ] All UI text translates correctly (English, Greek, Italian, Spanish, French)
- [ ] Language switcher works
- [ ] Language preference persists

### Search in Different Languages
- [ ] Greek search: "Θεατρικές εκδηλώσεις στη Ρώμη"
- [ ] Italian search: "eventi musicali a Roma"
- [ ] Spanish search: "eventos de comida en Madrid"
- [ ] French search: "concerts à Paris"
- [ ] City names normalize correctly (e.g., "Ρώμη" → "Rome")

### Language Detection
- [ ] Events in Greek are detected as `language: "el"`
- [ ] Events in Italian are detected as `language: "it"`
- [ ] Events in Spanish are detected as `language: "es"`
- [ ] Events in French are detected as `language: "fr"`
- [ ] Low confidence detections store `language: "unknown"`

---

## 📊 Data Integrity Testing

### Language & Embeddings
- [ ] New events get language detected
- [ ] New events get embeddings generated
- [ ] Edited events regenerate language
- [ ] Edited events regenerate embeddings
- [ ] Events save even if language/embedding fails
- [ ] Admin can see language and embedding status

### Database Consistency
- [ ] No orphaned records
- [ ] Foreign key constraints work
- [ ] Cascade deletes work correctly
- [ ] Audit logs are created for all admin actions

---

## 🐛 Edge Cases & Error Scenarios

### Invalid Inputs
- [ ] Empty search query
- [ ] Very long search query (> 1000 chars)
- [ ] Special characters in search
- [ ] Invalid dates (past dates, invalid format)
- [ ] Missing required fields

### Graceful Degradation (One-Pass Verification)

**Rationale:** Beta should confirm that failures degrade gently — not exhaustively simulate all outages. This is a single-pass check, not exhaustive failure simulation.

**Single Checklist Item:**
- [ ] **Verify graceful degradation when external services fail:**
  - [ ] **OpenAI API fails** (timeout or error):
    - [ ] Event submission still succeeds
    - [ ] Edit still succeeds
    - [ ] Logs clearly show degraded mode (e.g., `[events] Language detection failed`, `[events] Embedding generation failed`)
    - [ ] No user-visible errors unless unavoidable
    - [ ] Search still works (without semantic search)
  
  - [ ] **Google Search API fails:**
    - [ ] Search still works (database results only)
    - [ ] No user-visible errors
    - [ ] Logs show degraded mode
  
  - [ ] **Geocoding service fails:**
    - [ ] Event submission still succeeds
    - [ ] Event created without coordinates
    - [ ] No user-visible errors
  
  - [ ] **Redis (rate limiting) fails:**
    - [ ] System continues to work (fails open)
    - [ ] Logs show rate limiting disabled
    - [ ] No user-visible errors

**Success Criteria:**
- ✅ System degrades gracefully, not catastrophically
- ✅ Users can still complete core actions
- ✅ Logs clearly indicate degraded mode
- ✅ No user-visible errors unless truly unavoidable

**Note:** Do not over-engineer failure simulation. One verification pass is sufficient.

### Boundary Conditions
- [ ] Maximum event title length (120 chars)
- [ ] Maximum description length (5000 chars)
- [ ] Maximum categories (10)
- [ ] Maximum images (10)
- [ ] Rate limit boundaries

---

## 📝 Logging & Monitoring

### Logging Verification
- [ ] Language detection logs appear: `[language-detection]`
- [ ] Embedding generation logs appear: `[embeddings]`
- [ ] Search logs appear: `[v0]`
- [ ] Error logs are detailed
- [ ] No sensitive data in logs

### Monitoring Setup
- [ ] Error rate monitoring (check logs regularly)
- [ ] API response time monitoring
- [ ] Database query performance monitoring
- [ ] Email delivery monitoring
- [ ] Rate limit hit monitoring

---

## 🔄 Additional Feature Verification

### Language Detection & Embeddings
- [ ] Language detection confidence threshold works (< 0.7 → "unknown")
- [ ] Admin can see language in event table
- [ ] Admin can see embedding status in event detail view
- [ ] Low confidence detections store "unknown" (not null)

### Location Disambiguation (Ithaki Fix)
- [ ] "Ithaki, Greece" searches return Greek island results
- [ ] "Ithaca, USA" searches return US city results
- [ ] Country filtering works in internal search
- [ ] Country included in external web search queries

---

## 📋 Pre-Launch Verification

### Final Checks (Priority Order)

**1. Edit-Flow Semantic Freshness (CRITICAL)**
- [ ] Edit event and verify language/embedding regeneration
- [ ] Verify edited events remain searchable with new content
- [ ] Confirm no user-visible errors during edit

**2. Plain-Language Search Reasonableness (CRITICAL)**
- [ ] Test "something fun tonight", "food near me", "kids stuff Sunday"
- [ ] Verify results feel reasonable, not perfect
- [ ] Confirm system feels forgiving, not judgmental

**3. Environment + Database Verification (CRITICAL)**
- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Extensions enabled (pgvector, pg_trgm)
- [ ] Smoke tests pass in production

**4. Admin Access + Email (CRITICAL)**
- [ ] Admin user created and tested
- [ ] Email delivery working
- [ ] Edit links work correctly

**5. Graceful Degradation (VERIFY)**
- [ ] Single-pass verification of service failure handling
- [ ] Confirm system degrades gracefully
- [ ] Verify logs show degraded mode

**6. General Checks**
- [ ] No critical errors in logs
- [ ] Rate limiting configured (optional but recommended)
- [ ] Beta tester guidance prepared

### Documentation
- [ ] README.md is up to date
- [ ] API documentation is current
- [ ] Beta tester guide prepared (if needed)
- [ ] Known limitations documented

---

## 🎯 Beta Test Scope & Framing

### Beta Tester Expectations & Guidance

**For Beta Testers:**

We encourage you to:
- **Search in plain language** - Use natural, casual queries like "something fun tonight" or "food near me"
- **Use your first language** - Search in Greek, Italian, Spanish, French, or English — whatever feels natural
- **Report expectations** - Tell us "I expected X but got Y" — this helps us understand your intent
- **Focus on reasonableness** - Results don't need to be perfect, but they should feel reasonable and relevant

**What We're Learning:**
- Does the system understand your intent?
- Do results feel reasonable, even if not perfect?
- Does the system feel forgiving or judgmental?
- Would you try another search, or did you feel discouraged?

**Feedback Quality:**
- "I searched 'kids stuff Sunday' and got family events — that felt right"
- "I searched 'music things' and got concerts — perfect"
- "I searched 'something fun tonight' and got nothing — felt too strict"
- "I edited my event but search still shows old title — feels stale"

### What to Test with Beta Users:
1. **Plain-Language Search** - Natural, casual queries in multiple languages
2. **Event Submission** - Real-world event creation
3. **Editing** - Edit link workflow and semantic freshness
4. **Multilingual** - UI and search in your first language
5. **Moderation** - Admin review process (for admins)

### Beta Test Duration:
- **Recommended:** 2-4 weeks
- **User Count:** 10-50 beta testers
- **Focus:** Real-world usage, plain-language queries, first-language searches

---

## 🚨 Known Issues & Limitations

### Current Limitations:
1. Rate limiting requires Upstash Redis (fails open if not configured)
2. Email delivery depends on Resend service
3. AI moderation requires OpenAI API key and credits
4. Web search requires Google Programmable Search Engine setup
5. Embeddings are optional - search works without them

### Non-Blocking Issues:
- Some API routes use `console.log` (can migrate to structured logger)
- Unit test coverage could be expanded
- Performance monitoring could be enhanced

---

## 🚫 What We Will NOT Fix During Beta

**To avoid scope creep and misaligned fixes, we explicitly state:**

### Out of Scope During Beta:
- ❌ **No new features** - Focus on correctness, not expansion
- ❌ **No major ranking overhauls** - Tune, don't redesign
- ❌ **No UI redesigns** - Polish, don't rebuild
- ❌ **No new integrations** - Stabilize existing, don't add new

### In Scope During Beta:
- ✅ **Correctness fixes** - Bugs that break core functionality
- ✅ **Trust improvements** - Fixes that build user confidence
- ✅ **Clarity improvements** - Better error messages, clearer feedback
- ✅ **Semantic freshness** - Ensuring edited events stay searchable
- ✅ **Plain-language forgiveness** - Making search more forgiving
- ✅ **Graceful degradation** - Ensuring failures don't break core flows

**Focus:** Stability, trust, and clarity — not new features or major changes.

---

## ✅ Sign-Off

**Ready for Beta:** ☐ Yes  ☐ No

**Completed by:** _________________  
**Date:** _________________  
**Notes:** _________________

---

## 📞 Support & Troubleshooting

### Common Issues:
1. **Database connection errors** → Check `DATABASE_URL`
2. **Email not sending** → Check `RESEND_API_KEY`
3. **Search not working** → Check `OPENAI_API_KEY`
4. **Rate limiting not working** → Check Upstash Redis config (optional)
5. **Embeddings not generating** → Check `OPENAI_API_KEY` and logs

### Debug Endpoints:
- `/api/status` - System status
- `/api/health/env` - Environment check (dev only)

---

**Last Updated:** 2025-01-XX  
**Version:** 0.8.0

