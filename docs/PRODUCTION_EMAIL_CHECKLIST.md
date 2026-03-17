# Production Email Configuration Checklist — Eventa

## 1. Variable checklist

| Variable | Required for | Notes |
|----------|--------------|--------|
| **RESEND_API_KEY** | All app emails | Resend API key (e.g. `re_live_...`). Edit-link, admin, and appeal emails use Resend. |
| **EMAIL_FROM** | All app emails | Sender address; must be a **verified** sender in Resend (e.g. `no-reply@eventa.app`). |
| **NEXT_PUBLIC_APP_URL** | All app emails (correct links) | Public app URL with scheme, no trailing slash (e.g. `https://eventa.app`). Used for edit and admin links in emails. |
| **ADMIN_NOTIFICATION_EMAIL** | Admin notifications only | Where moderation/needs-review and appeal notifications are sent (e.g. `moderation@eventa.app`). If unset, falls back to `EMAIL_FROM`. |
| **EMAIL_SERVER_HOST** | NextAuth email login only | SMTP host (e.g. `smtp.resend.com` if using Resend SMTP for NextAuth). |
| **EMAIL_SERVER_PORT** | NextAuth email login only | SMTP port (e.g. `465`). |
| **EMAIL_SERVER_USER** | NextAuth email login only | SMTP user. |
| **EMAIL_SERVER_PASSWORD** | NextAuth email login only | SMTP password (e.g. Resend API key if using Resend SMTP). |

**Summary:**

- **All app emails (edit-link, admin, appeals):** `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`. Optional but recommended: `ADMIN_NOTIFICATION_EMAIL`.
- **Admin notifications only:** `ADMIN_NOTIFICATION_EMAIL` (or rely on `EMAIL_FROM` fallback).
- **NextAuth email login only:** `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, and `EMAIL_FROM`. The magic-link send in this app uses Resend (`sendEmailAPI`), so `RESEND_API_KEY` is also required for NextAuth magic links to send.

---

## 2. Copy-paste example (production)

Replace placeholders with your real values (Resend API key, SMTP password if different).

```env
# --- Resend (all app emails: edit-link, admin, appeals) ---
RESEND_API_KEY=re_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=no-reply@eventa.app
NEXT_PUBLIC_APP_URL=https://eventa.app

# --- Admin notifications (optional; defaults to EMAIL_FROM) ---
ADMIN_NOTIFICATION_EMAIL=moderation@eventa.app

# --- NextAuth email login only (magic links; app sends via Resend) ---
EMAIL_SERVER_HOST=smtp.resend.com
EMAIL_SERVER_PORT=465
EMAIL_SERVER_USER=resend
EMAIL_SERVER_PASSWORD=re_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Before deploy:**

- [ ] `RESEND_API_KEY` set and valid (Resend dashboard).
- [ ] `EMAIL_FROM` is a verified sender in Resend (`no-reply@eventa.app` or your domain).
- [ ] `NEXT_PUBLIC_APP_URL` is `https://eventa.app` (or your production URL), no trailing slash.
- [ ] `ADMIN_NOTIFICATION_EMAIL` set if you want moderation emails to a dedicated inbox.
- [ ] If using NextAuth email login: all four `EMAIL_SERVER_*` vars set; `EMAIL_FROM` set; `RESEND_API_KEY` set (magic links are sent via Resend in this app).

---

## 3. Deployment readiness (email & links)

**Verdict: Safe to deploy** once the checklist above is satisfied and the following hardening is in place:

- **Admin notification links** use the same URL normalization as edit-link emails (`lib/admin-notifications.tsx`: `resolveAppUrl` for `APP_URL`). Applied.
- **Startup warnings** in production when `RESEND_API_KEY`, `EMAIL_FROM`, or `NEXT_PUBLIC_APP_URL` are missing (`lib/email.ts`). Applied.

**Other email-related URL usage (no change in this pass):**

- Edit-link and submit flow: use `NEXT_PUBLIC_APP_URL` or `request.nextUrl.origin`; `lib/email.ts` normalizes and logs localhost.
- Calendar ICS: uses `NEXT_PUBLIC_APP_URL || "https://eventa.app"` (production-safe fallback).
- Appeal submission email (admin “Review Appeal” link): uses `request.nextUrl.origin`. In production this is usually correct; if you run behind a proxy, ensure the request origin is the public URL or consider using `NEXT_PUBLIC_APP_URL` there in a later pass.
