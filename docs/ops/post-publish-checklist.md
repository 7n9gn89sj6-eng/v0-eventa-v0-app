# Post-Publish Operations Checklist

Quick reference for verifying and monitoring production deployments.

---

## 1. Run Production Smoke Tests

### Option A: GitHub Actions (Recommended)

1. Go to **Actions** tab in GitHub
2. Select **"Production Smoke Test"** workflow
3. Click **"Run workflow"**
4. Enter your production URL (e.g., `https://eventa.example.com`)
5. Click **"Run workflow"** button
6. Monitor the results - all checks should pass ✓

**What it tests:**

- `/api/status` returns healthy JSON
- Homepage is accessible (200 or 302)
- `/api/health/env` is protected (NOT 200)

### Option B: Local Script

\`\`\`bash
# Set your production URL
export PROD_URL=https://eventa.example.com

# Run smoke tests
npm run smoke:prod
\`\`\`

**Expected output:**

\`\`\`
✓ /api/status is healthy
✓ Homepage is accessible
✓ /api/health/env is protected
All checks passed!
\`\`\`

### Search (`/api/search/events`)

After deploy, use **[production-search-confidence.md](./production-search-confidence.md)** for doctrine-aligned manual checks (global scope wording, broad queries, trust-suite gate).

---

## 2. Verify Date Parsing (Temporary Diagnostic)

Use this to verify Sunday edge cases and DST handling are working correctly.

### Enable Diagnostic Endpoint

1. In your host dashboard (e.g. **Render** → your Web Service → **Environment**), add: `DIAG_ENDPOINT=1` for the production environment.
2. Redeploy or wait for the service to restart with the new variable.

### Test the Endpoint

\`\`\`bash
curl https://eventa.example.com/api/diag/date | jq
\`\`\`

**What to verify:**

- `currentMelbourneTime` shows correct timezone (UTC+10 or UTC+11)
- `parsedDates.thisWeekend` is reasonable (next Saturday if today is Sunday)
- `parsedDates.nextMonday` is correct
- `calculations.daysUntilSaturday` matches expectations

### Disable Diagnostic Endpoint

1. Remove `DIAG_ENDPOINT` from environment variables in the host dashboard.
2. Redeploy or restart.
3. Verify endpoint returns 404: `curl -I https://eventa.example.com/api/diag/date`

**⚠️ Important:** Don't leave this enabled long-term - it's for debugging only.

---

## 3. Monitor Production Logs

Use your hosting provider’s log viewer (e.g. **Render Dashboard** → your service → **Logs**, or `render logs` from the [Render CLI](https://render.com/docs/cli) if installed).

- Filter by time range and search for errors or a specific path (e.g. `/api/status`).
- For deep debugging of search, see [production-search-confidence.md](./production-search-confidence.md) §4.

---

## 4. Rollback or Redeploy (If Needed)

On **Render** (and similar Git-based hosts):

1. Open the service **Events** / **Deploy** history.
2. **Redeploy** a known-good commit or the previous successful deploy.
3. Re-run smoke tests: `PROD_URL=https://... npm run smoke:prod`

If you use preview environments or multiple services, follow your provider’s docs for promoting a specific build.

---

## 5. Automated Monitoring

The **Production Ping** workflow runs automatically every 15 minutes.

### Check Status

1. Go to **Actions** tab in GitHub
2. Select **"Production Ping"** workflow
3. View recent runs

### Configure (First Time)

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add repository secret: `PROD_URL` = `https://eventa.example.com`
3. The workflow will start running automatically

### Disable Monitoring

1. Edit `.github/workflows/prod-ping.yml`
2. Comment out the `schedule:` section
3. Commit and push

---

## Quick Reference

| Task | Command / location |
|------|-------------------|
| Smoke test (local) | `PROD_URL=https://... npm run smoke:prod` |
| Production logs | Host dashboard (e.g. Render → Logs) |
| Rollback | Redeploy previous build in host dashboard |
| Check diagnostic endpoint | `curl https://.../api/diag/date` |

---

## Troubleshooting

### Smoke tests fail

1. Check latest deploy status in the host dashboard
2. Tail logs for errors around the failure time
3. Verify environment variables (database, auth, optional APIs)
4. Verify database connection (Neon)
5. Check Upstash Redis connection

### Date parsing issues

1. Enable `DIAG_ENDPOINT=1` temporarily
2. Check `/api/diag/date` output
3. Verify Melbourne timezone calculations
4. Check for DST transition dates
5. Review logs for parsing errors

### Need to roll back

1. Redeploy a previous successful release in the host dashboard
2. Run smoke tests to verify
3. Investigate the failing deploy separately

---

**Last Updated:** 2026-03-20
