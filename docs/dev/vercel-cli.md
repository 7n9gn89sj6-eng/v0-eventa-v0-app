# Vercel CLI Operations Guide

This guide covers common Vercel CLI operations for managing deployments, debugging production issues, and performing rollbacks.

## Installation

Install the Vercel CLI globally:

\`\`\`bash
npm install -g vercel
\`\`\`

Authenticate with your Vercel account:

\`\`\`bash
vercel login
\`\`\`

Link your local project to the Vercel project:

\`\`\`bash
vercel link
\`\`\`

## Common Commands

### List Deployments

List all production deployments:

\`\`\`bash
vercel ls --prod
\`\`\`

List all deployments (including preview):

\`\`\`bash
vercel ls
\`\`\`

Get deployment list as JSON for scripting:

\`\`\`bash
vercel ls --prod --json
\`\`\`

### Tail Production Logs

View logs from the last hour (using npm script):

\`\`\`bash
npm run vercel:logs
\`\`\`

Or directly with Vercel CLI:

\`\`\`bash
vercel logs --prod --since=1h
\`\`\`

View logs from a specific time range:

\`\`\`bash
vercel logs --prod --since=24h
vercel logs --prod --since=2024-01-15
\`\`\`

Follow logs in real-time:

\`\`\`bash
vercel logs --prod --follow
\`\`\`

### Inspect a Specific Deployment

Get detailed information about a deployment:

\`\`\`bash
vercel inspect <deployment-url>
\`\`\`

### Promote a Previous Deployment (Rollback)

**IMPORTANT**: Always use the helper script first to identify the deployment:

\`\`\`bash
npm run vercel:promote
\`\`\`

This will:
1. List the previous production deployment (not the current one)
2. Show its URL and creation time
3. Print the exact `vercel promote` command to run

**Manual confirmation required**: Copy and run the printed command:

\`\`\`bash
vercel promote <deployment-url>
\`\`\`

This promotes the previous deployment to production, effectively rolling back the latest deployment.

### Direct Rollback (Advanced)

If you know the deployment URL you want to promote:

\`\`\`bash
vercel promote https://your-app-abc123.vercel.app
\`\`\`

## Safety Notes

- **Always verify** the deployment URL before promoting
- **Test in preview** environments first when possible
- **Communicate** with your team before rolling back production
- **Document** the reason for rollback in your incident log
- The `promote-prev.mjs` script intentionally requires manual confirmation to prevent accidental rollbacks

## Environment Variables

View environment variables for a project:

\`\`\`bash
vercel env ls
\`\`\`

Add a new environment variable:

\`\`\`bash
vercel env add <name>
\`\`\`

Remove an environment variable:

\`\`\`bash
vercel env rm <name>
\`\`\`

## Troubleshooting

### View Build Logs

\`\`\`bash
vercel logs <deployment-url> --build
\`\`\`

### Check Deployment Status

\`\`\`bash
vercel inspect <deployment-url>
\`\`\`

### Force Redeploy

\`\`\`bash
vercel --force
\`\`\`

## Automated Monitoring

### GitHub Actions Health Ping

The repository includes an automated health check that pings production every 15 minutes:

**Workflow**: `.github/workflows/prod-ping.yml`

**Setup**:
1. Go to your GitHub repository settings
2. Navigate to **Secrets and variables** → **Actions**
3. Add a new repository secret:
   - Name: `PROD_URL`
   - Value: `https://your-production-domain.com` (no trailing slash)

**Features**:
- Runs every 15 minutes automatically
- Checks `/api/status` endpoint
- 30-second timeout per request
- Fails if endpoint returns non-200 or times out
- Sends GitHub Actions annotations on failure
- Can be manually triggered from Actions tab

**Monitoring Failures**:
- Failed runs appear in the Actions tab
- GitHub can send email notifications for workflow failures
- Configure notifications: Settings → Notifications → Actions

**Cost**: Minimal - uses ~2 minutes of GitHub Actions time per day

**Disable**: Comment out or delete the `schedule:` section in the workflow file

## Additional Resources

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Vercel Deployments](https://vercel.com/docs/deployments/overview)
- [Vercel Logs](https://vercel.com/docs/observability/runtime-logs)
