# Eventa Email System Audit

**Scope:** Configuration, reliability, and production-safety of the email system.  
**Provider:** Resend.  
**Status:** Audit only — no code changes applied unless critical.

---

## 1. Email-related files

| File | Role |
|------|------|
| `lib/email.ts` | Core: `coreSend`, `sendEmailAPI`, `sendSafeEmail`, `sendEventEditLinkEmailAPI`, `sendEmail`. Single place that uses Resend. |
| `lib/admin-notifications.tsx` | Admin notifications: `notifyAdminsEventNeedsReview`, `notifyAdminsEventUpdated`. Uses `sendSafeEmail` from `lib/email`. |
| `lib/admin-email.ts` | Legacy wrapper around Resend. **Not imported anywhere** — dead code for current flows. |
| `lib/eventEditToken.ts` | Edit token: create (hash + store), validate. No email; used by submit + regenerate-token. |
| `app/api/events/submit/route.ts` | Triggers edit-link email and (when needed) admin notification. |
| `app/api/events/[id]/regenerate-token/route.ts` | Optionally sends edit-link email with new token. |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth magic-link send via `sendEmailAPI` (Resend). |
| `app/api/admin/events/[id]/appeal/route.ts` | Sends appeal outcome to user via `sendEmailAPI`. |
| `app/api/events/[id]/appeal/route.ts` | Notifies admin of new appeal via `sendSafeEmail` (uses `ADMIN_EMAIL` or `EMAIL_FROM`). |
| `app/api/test-email/route.ts` | Diagnostic send using Resend. |
| `lib/env.ts` | Zod env schema: requires **SMTP** vars (`EMAIL_SERVER_*`, `EMAIL_FROM`). **Not used by Resend paths** — `lib/email.ts` reads `process.env` directly. |

---

## 2. Environment configuration

### RESEND_API_KEY

- **Where read:** `lib/email.ts` line 24: `const RESEND_KEY = process.env.RESEND_API_KEY;` (module load).  
  Also checked in `coreSend()` (line 99).  
  `lib/admin-email.ts` line 5: `new Resend(process.env.RESEND_API_KEY)` (unused in current flows).
- **Required/optional:** Effectively **required** for any email to send. Not validated at startup.
- **If missing:**  
  - `lib/email.ts`: `resend` is `null`, `coreSend` returns `{ success: false, error: "[email] RESEND_API_KEY missing – email not sent" }` without calling Resend.  
  - Log: `console.error(msg)`.
- **Fallback:** None. Safe: no send, no throw.

### EMAIL_FROM

- **Where read:**  
  - `lib/email.ts` lines 11–19: `getDefaultFrom()` → used as `FROM` (module load).  
  - `lib/admin-email.ts` line 45: `process.env.EMAIL_FROM || "no-reply@eventa.app"` (unused path).  
  - NextAuth route: used for `emailReady` and provider `from`.  
  - `app/api/test-email/route.ts`, `lib/auth.tsx`, etc.
- **Required/optional:** Optional at code level. If missing in production, `lib/email.ts` uses **hardcoded** `no-reply@ithakigrouptour.com` (line 19).
- **If missing:**  
  - Development: `onboarding@resend.dev`.  
  - Production: `no-reply@ithakigrouptour.com`.  
  - Risk: Production from-address may be wrong or unverified for the app’s domain; Resend can reject or route to spam.
- **Fallback:** Safe for “something sends”; **risky** for correct branding and deliverability if not set explicitly.

### ADMIN_NOTIFICATION_EMAIL

- **Where read:** `lib/admin-notifications.tsx` line 8: `process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_FROM || ""`.
- **Required/optional:** Optional. If both are missing, admin notifications are skipped.
- **If missing (and EMAIL_FROM missing):**  
  - `DEFAULT_ADMIN_EMAIL === ""`.  
  - `notifyAdminsEventNeedsReview` / `notifyAdminsEventUpdated` return `{ success: false, error: "No admin email configured" }` immediately; no send, no throw.  
  - One-time log at module load: `[admin-notifications] No ADMIN_NOTIFICATION_EMAIL or EMAIL_FROM set – admin emails will be skipped.`
- **Fallback:** EMAIL_FROM as admin address. Safe; no silent wrong-recipient.

### NEXT_PUBLIC_APP_URL

- **Where read:**  
  - `lib/email.ts` line 23: `RAW_APP_URL`; then `resolveAppUrl(RAW_APP_URL)` → `APP_URL`.  
  - `lib/email.ts` in `sendEventEditLinkEmailAPI`: again `process.env.NEXT_PUBLIC_APP_URL` for edit-link base.  
  - `lib/admin-notifications.tsx` line 16: `APP_URL` for admin links (no `resolveAppUrl`).  
  - Submit route: `process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin` passed as `baseUrl` to `sendEventEditLinkEmailAPI`.  
  - Regenerate-token: same pattern.  
  - Calendar route, search/intent, etc.
- **Required/optional:** Optional. Fallback in `lib/email.ts`: `http://localhost:3000`.
- **If missing:**  
  - Edit-link: submit passes `request.nextUrl.origin` as `baseUrl`, so server’s request origin is used (correct in many deployments).  
  - If that’s not set, `sendEventEditLinkEmailAPI` falls back to `APP_URL` = `resolveAppUrl("http://localhost:3000")` → **localhost** in production = **wrong links**.  
  - Admin notifications: `APP_URL` becomes `"http://localhost:3000"` → admin links point to localhost.
- **Fallback:** Safe for local dev; **dangerous** in production (localhost links, or non-HTTPS if origin is wrong).  
- **Invalid value:** In `lib/email.ts`, `resolveAppUrl` catches and falls back to `http://localhost:3000` and logs. In `admin-notifications.tsx`, no validation — invalid URL can be used as-is (e.g. missing protocol or double slash if trailing slash in env).

**Summary – silent no-send / wrong links:**

- **Silent no-send:** RESEND_API_KEY missing → all sends return `success: false`, logged; user can see `emailSent: false` on submit. Admin notification returns error to caller; submit logs and returns `adminNotification.sent: false`.
- **Wrong base URL:** NEXT_PUBLIC_APP_URL missing in production (and no request origin) → edit and admin links can be localhost. Admin link also doesn’t use `resolveAppUrl`, so malformed env can produce bad links.

---

## 3. Email send flow (exact)

### 3.1 Submitter edit-link email

1. **Trigger:** `app/api/events/submit/route.ts` after event create and moderation.
2. **Steps:**  
   - `createEventEditToken(event.id, endOrStart)` → token string; DB row with hashed token, expiry.  
   - `baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin`.  
   - `sendEventEditLinkEmailAPI(creatorEmail, title, event.id, token, baseUrl)` awaited.  
   - Inside `sendEventEditLinkEmailAPI`:  
     - URL base: prefer `NEXT_PUBLIC_APP_URL` (resolved), else `baseUrl`, else `APP_URL`.  
     - `buildAppUrl(\`/edit/${eventId}\`, { token }, urlBase)` → edit URL.  
     - HTML built with escaped title and edit URL.  
     - `return await coreSend(to, subject, html)`.  
   - `coreSend`: checks `resend`/RESEND_KEY, `isPlausibleEmail(to)`, then `resend.emails.send(...)`. Returns `{ success, error? }` or `{ success, result }`.  
   - Submit route sets `emailSent = emailResult.success`, and on failure sets `emailWarning` and logs.  
   - Response includes `emailSent`, `emailWarning` when applicable.
3. **Errors:** All caught in submit try/catch; submission still 200. Result and errors returned/logged; no branch skipped.

### 3.2 Admin notification (needs review / moderation failed)

1. **Trigger:** Same submit route when `moderationOutcome === "needs_review"` or after moderation throw (`moderation_failed`).
2. **Steps:**  
   - `notifyAdminsEventNeedsReview({ eventId, title, city, country, aiStatus, aiReason })` awaited.  
   - In `admin-notifications.tsx`: if `!DEFAULT_ADMIN_EMAIL` return `{ success: false, error: "No admin email configured" }`.  
   - Build link: `APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"` (no `resolveAppUrl`).  
   - `sendSafeEmail({ to: DEFAULT_ADMIN_EMAIL, subject, html, ... })` → `coreSend(to, subject, html)` (same as edit-link).  
   - Returns `{ success, error? }` or `{ success, messageId }`.  
   - Submit route sets `adminNotificationSent = notifyResult.success`, logs on failure, and includes `adminNotification: { attempted, sent }` in response.
3. **Errors:** No throw; caller checks return. Response and logs make failures visible.

**Conclusion:** Both paths are invoked in the expected places, awaited, and do not silently skip; failures are reflected in return values and logs and (for submit) in the API response.

---

## 4. Edit-link correctness

- **Token generation:** `lib/eventEditToken.ts`: `randomUUID()`, bcrypt hash (cost 12), stored in `EventEditToken` with `eventId` and `expires`. Plain token never stored; only returned to caller and put in email link. **Secure and usable.**
- **Expiry:** `Math.max(creation + 30d, eventEnd + 30d)`. **Correct.**
- **URL construction:** `buildAppUrl(\`/edit/${eventId}\`, { token }, urlBase)` normalizes path and query. If `buildAppUrl` throws, fallback is `\`${urlBase}/edit/${eventId}?token=${token}\``. **Valid in production** provided `urlBase` is correct.
- **Base URL selection:** In submit, `baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin`; inside `sendEventEditLinkEmailAPI`, env is preferred then `baseUrl` then `APP_URL`. So production must set `NEXT_PUBLIC_APP_URL` to a full public base (e.g. `https://eventa.app`) or links can be localhost/wrong. **Correct only if env or origin is correct.**

**Risks:**  
- NEXT_PUBLIC_APP_URL unset in production → localhost or request origin (may be internal).  
- Admin notification link uses raw `APP_URL` with no `resolveAppUrl` → possible double slash or invalid URL if env has trailing slash or typo.

---

## 5. Silent failure and visibility

| Case | What happens in code | User sees | Admin sees | Logs |
|------|----------------------|-----------|------------|------|
| RESEND_API_KEY missing | `coreSend` returns `{ success: false, error: "..." }`; no Resend call | Submit: 200, `emailSent: false`, `emailWarning` set. Regenerate/NextAuth: error or no send | No admin email | `console.error` in coreSend |
| EMAIL_FROM invalid | Resend may reject; `result.error` in response or throw | Same as above if we return failure | Same | Resend error logged |
| ADMIN_NOTIFICATION_EMAIL missing | `notifyAdminsEventNeedsReview` returns immediately `{ success: false }` | Submit: 200, `adminNotification.sent: false` | No email | Module-load warn once |
| Resend API error | `result.error` or catch; return `{ success: false, error }` | Submit: 200, `emailSent: false` + warning | Admin: `adminNotification.sent: false` | `console.error` / logger |
| Invalid recipient (e.g. user email) | `isPlausibleEmail(to)` false → return `{ success: false }` | Submit: 200, `emailSent: false` | N/A | `console.warn` |
| Network failure | Exception in `resend.emails.send`; caught; return `{ success: false }` | Same as Resend error | Same | `console.error` |

So: **no send** is always reflected in return values and (for submit) in response payload; **user/admin** can be aware if the frontend shows `emailSent` / `adminNotification.sent`; **logs** record failures. The only “silent” part is if nobody checks logs or response.

---

## 6. Provider / runtime assumptions

- **Resend:** Rate limits and domain verification are provider-side. Code does not check them. Emails can be **accepted** by the API and still **bounce or be marked spam** if the from-domain is not verified or limits are hit. Not visible in this codebase.
- **From address:** Production fallback `no-reply@ithakigrouptour.com` may not match the app’s Resend domain; could cause reject or spam.
- **Sandbox/test:** Resend test domain `onboarding@resend.dev` is only used when `NODE_ENV === "development"` and `EMAIL_FROM` is unset. Production should set `EMAIL_FROM` to a verified domain.
- **Serverless / runtime:** Edit-link and admin notification sends are **awaited** in the submit handler before the response is sent. No fire-and-forget in that path. So emails are not lost due to request termination in the main flow. Regenerate-token and appeal routes also await the send.

---

## 7. Truth table

| Scenario | Email send attempted? | Email delivered? | User aware? | Admin aware? | Logs? |
|----------|------------------------|------------------|-------------|--------------|-------|
| 1. Normal success | Yes | Yes (if Resend/domain ok) | Yes (success message) | Yes (email) | Yes |
| 2. RESEND_API_KEY missing | Yes (code path runs) | No | Yes (`emailSent: false`, warning) | Yes (`adminNotification.sent: false` if applicable) | Yes (error) |
| 3. EMAIL_FROM invalid | Yes | Depends on Resend | Yes if Resend returns error | Yes if we return error | Yes |
| 4. Admin email missing | Edit-link: yes. Admin: no (early return) | Edit-link: yes. Admin: no | Yes for edit-link | No email; response has `sent: false` | Module warn |
| 5. Resend API failure | Yes | No | Yes (`emailSent: false`) | Yes (`sent: false`) | Yes |
| 6. Invalid user email | Yes (attempt) | No (refused in coreSend) | Yes (`emailSent: false`) | N/A | Yes (warn) |
| 7. NEXT_PUBLIC_APP_URL missing | Yes | Yes | Yes | Yes | Yes (localhost warn in email.ts) |
| 7b. Links in emails | — | — | **Wrong link** (localhost) if origin also wrong | **Wrong link** (localhost) | Yes (warn) |

---

## 8. Classification

- **Working (as designed):**  
  - Single Resend path in `lib/email.ts`; key missing causes no-send with clear return and logs.  
  - Edit token creation/validation and expiry.  
  - Submit response includes `emailSent` and `adminNotification.sent` so clients can show truth.  
  - All sends in submit/regenerate/appeal/admin are awaited; no request-termination loss.

- **Partially reliable:**  
  - Base URL for edit links: correct when `NEXT_PUBLIC_APP_URL` or request origin is correct; wrong (localhost) otherwise in production.  
  - Admin link built with raw `NEXT_PUBLIC_APP_URL` (no `resolveAppUrl`) → possible malformed or double-slash URLs.  
  - EMAIL_FROM production fallback is a hardcoded third-party domain; deliverability/verification not guaranteed.

- **Risky:**  
  - No startup check for RESEND_API_KEY or EMAIL_FROM; first failure is at first send.  
  - Admin notification “no admin email” only logs once at module load; easy to miss.  
  - NextAuth “emailReady” is based on SMTP vars while actual send uses Resend — config mismatch possible.

- **Broken / unused:**  
  - `lib/admin-email.ts` is never imported; duplicate/legacy.  
  - `lib/env.ts` SMTP schema is not used by Resend flows; misleading if someone thinks env is validated for current email.

---

## 9. Recommended diffs (critical only)

Only two changes are suggested as **critical** for production safety and correctness; the rest can be follow-ups.

### 9.1 (Critical) Use resolved app URL in admin notifications

Admin links should use the same normalization as edit links so that a missing or malformed `NEXT_PUBLIC_APP_URL` is handled and we avoid double slashes or invalid hrefs.

**File:** `lib/admin-notifications.tsx`

- Add the same `resolveAppUrl` logic used in `lib/email.ts` (or import a shared helper), and set `APP_URL` to `resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")` so the admin link is built from a normalized base.

### 9.2 (Critical) Do not expose raw edit token in regenerate-token response

**File:** `app/api/events/[id]/regenerate-token/route.ts`

- The response currently includes `token` and `editUrl` in the JSON. That is acceptable for an admin-only endpoint, but the token is sensitive. If this API is ever exposed to non-admins or logged, it becomes a security issue. Recommended: remove `token` from the response (and optionally `editUrl`), or restrict to admin-only and document that the response must not be logged or cached. (If you already restrict and don’t log, this can be “recommended” rather than “critical”.)

---

## 10. Exact diff (critical: admin link URL normalization)

**Reason:** Admin notification emails build the dashboard link with raw `process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"` with no validation or normalization. That can produce invalid or localhost links in production. Use the same resolution logic as edit-link emails.

**File:** `lib/admin-notifications.tsx`

```diff
 import { sendSafeEmail } from "@/lib/email";

 const DEFAULT_ADMIN_EMAIL =
   process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_FROM || "";

 if (!DEFAULT_ADMIN_EMAIL) {
   console.warn(
     "[admin-notifications] No ADMIN_NOTIFICATION_EMAIL or EMAIL_FROM set – admin emails will be skipped."
   );
 }

-const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
+function resolveAppUrl(raw: string): string {
+  try {
+    const url = new URL(raw);
+    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
+      console.warn("[admin-notifications] NEXT_PUBLIC_APP_URL is not HTTPS in production:", raw);
+    }
+    const pathname = url.pathname.replace(/\/+$/, "");
+    return `${url.protocol}//${url.host}${pathname}`;
+  } catch (err) {
+    console.error("[admin-notifications] Invalid NEXT_PUBLIC_APP_URL, falling back to localhost:", raw, err);
+    return "http://localhost:3000";
+  }
+}
+
+const APP_URL = resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
```

No other code changes are required for this audit. Regenerate-token response sensitivity is recommended hardening, not critical, so no diff is included.
