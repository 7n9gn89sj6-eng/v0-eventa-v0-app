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

---

## 2. Verify Date Parsing (Temporary Diagnostic)

Use this to verify Sunday edge cases and DST handling are working correctly.

### Enable Diagnostic Endpoint

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `DIAG_ENDPOINT=1` (Production scope)
3. Redeploy or wait for next deployment

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

1. Go back to Vercel Environment Variables
2. **Delete** `DIAG_ENDPOINT` variable
3. Redeploy or wait for next deployment
4. Verify endpoint returns 404: `curl -I https://eventa.example.com/api/diag/date`

**⚠️ Important:** Don't leave this enabled long-term - it's for debugging only.

---

## 3. Monitor Production Logs

### Tail Recent Logs

\`\`\`bash
# View last hour of production logs
npm run vercel:logs

# Or use Vercel CLI directly
vercel logs --prod --since=1h
\`\`\`

### Follow Live Logs

\`\`\`bash
vercel logs --prod --follow
\`\`\`

### Filter Logs

\`\`\`bash
# Show only errors
vercel logs --prod --since=1h | grep ERROR

# Show specific endpoint
vercel logs --prod --since=1h | grep "/api/status"
\`\`\`

---

## 4. Rollback Deployment (If Needed)

### Find Previous Deployment

\`\`\`bash
# Shows previous deployment URL and promote command
npm run vercel:promote
\`\`\`

**Example output:**
\`\`\`
Previous production deployment:
  URL: https://eventa-abc123.vercel.app
  Created: 2025-01-15 10:30:00

To promote this deployment to production, run:
  vercel promote https://eventa-abc123.vercel.app
\`\`\`

### Promote Previous Deployment

\`\`\`bash
# Copy the command from above and run it
vercel promote https://eventa-abc123.vercel.app
\`\`\`

**⚠️ Confirmation required:** Vercel will ask you to confirm before promoting.

### Verify Rollback

\`\`\`bash
# Run smoke tests again
export PROD_URL=https://eventa.example.com
npm run smoke:prod
\`\`\`

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

| Task | Command |
|------|---------|
| Smoke test (local) | `PROD_URL=https://... npm run smoke:prod` |
| View logs | `npm run vercel:logs` |
| Find previous deployment | `npm run vercel:promote` |
| Rollback | `vercel promote <url>` |
| Check diagnostic endpoint | `curl https://.../api/diag/date` |

---

## Troubleshooting

### Smoke tests fail

1. Check Vercel deployment status
2. Tail logs: `npm run vercel:logs`
3. Check environment variables in Vercel dashboard
4. Verify database connection (Neon)
5. Check Upstash Redis connection

### Date parsing issues

1. Enable `DIAG_ENDPOINT=1` temporarily
2. Check `/api/diag/date` output
3. Verify Melbourne timezone calculations
4. Check for DST transition dates
5. Review logs for parsing errors

### Need to rollback

1. Run `npm run vercel:promote` to find previous deployment
2. Verify the previous deployment URL in Vercel dashboard
3. Run `vercel promote <url>` to rollback
4. Run smoke tests to verify
5. Investigate the issue in the rolled-back deployment

---

**Last Updated:** 2025-01-15
