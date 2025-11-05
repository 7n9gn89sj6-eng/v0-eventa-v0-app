# Security Guidelines

This document outlines the security measures implemented in the Eventa application and best practices for maintaining security.

## Implemented Security Measures

### 1. HTTP Security Headers
The application sets the following security headers via middleware:
- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-XSS-Protection: 1; mode=block` - Enables browser XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Content-Security-Policy` - Restricts resource loading to prevent XSS

### 2. Input Validation
All API endpoints implement:
- Zod schema validation for request bodies
- Length limits on all user inputs
- Pattern matching for category and search parameters
- Request size limits (max 50KB for event creation)
- URL sanitization to prevent javascript: and data: protocols

### 3. Data Protection
- Sensitive user data (emails, personal info) removed from public API responses
- Only published events exposed via public endpoints
- Authentication required for event creation
- Event edit tokens with expiration dates

### 4. XSS Prevention
Utility functions in `lib/sanitize.ts`:
- `sanitizeHtml()` - Removes script tags and event handlers
- `escapeHtml()` - Escapes HTML special characters
- `sanitizeUrl()` - Validates and sanitizes URLs

**Usage:**
\`\`\`typescript
import { sanitizeHtml, escapeHtml } from '@/lib/sanitize'

// For user-generated HTML content
const clean = sanitizeHtml(userInput)

// For displaying user input as text
const safe = escapeHtml(userText)
\`\`\`

### 5. Database Security
- Prisma ORM prevents SQL injection
- Parameterized queries throughout
- Row-level security considerations for multi-tenant data
- Indexes on frequently queried fields

## Known Limitations (v0 Preview)

### Authentication Disabled
- NextAuth is currently disabled for v0 preview compatibility
- All auth-protected endpoints will fail
- **Action Required**: Enable proper authentication before production deployment

### Rate Limiting
- Rate limiting infrastructure exists (Upstash) but not fully implemented
- **Action Required**: Add rate limiting to all public endpoints

### CORS
- No explicit CORS configuration
- **Action Required**: Configure CORS for production API access

## Security Checklist for Production

Before deploying to production, ensure:

- [ ] Enable and test NextAuth authentication
- [ ] Implement rate limiting on all public endpoints
- [ ] Configure CORS with specific allowed origins
- [ ] Set up monitoring and alerting for suspicious activity
- [ ] Enable HTTPS only (no HTTP)
- [ ] Rotate all secrets and API keys
- [ ] Set secure cookie flags (httpOnly, secure, sameSite)
- [ ] Implement CSRF protection
- [ ] Add request logging and audit trails
- [ ] Set up WAF (Web Application Firewall)
- [ ] Perform security audit and penetration testing
- [ ] Review and update CSP headers for your domain
- [ ] Implement proper session management
- [ ] Add input sanitization to all user-facing forms
- [ ] Set up automated security scanning (Dependabot, Snyk)

## Reporting Security Issues

If you discover a security vulnerability, please email security@eventa.app (placeholder - update with real contact).

Do NOT create public GitHub issues for security vulnerabilities.

## Security Best Practices for Developers

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Trust no user input
3. **Sanitize outputs** - Prevent XSS when rendering user content
4. **Use parameterized queries** - Prevent SQL injection
5. **Keep dependencies updated** - Regularly update npm packages
6. **Review code changes** - Security review for all PRs
7. **Test security features** - Include security tests in test suite
8. **Follow principle of least privilege** - Minimal permissions for all operations

## Environment Variables

Required environment variables for security:
\`\`\`
NEXTAUTH_SECRET=<random-string-min-32-chars>
DATABASE_URL=<postgres-connection-string>
EMAIL_SERVER_HOST=<smtp-host>
EMAIL_SERVER_PORT=<smtp-port>
EMAIL_SERVER_USER=<smtp-username>
EMAIL_SERVER_PASSWORD=<smtp-password>
EMAIL_FROM=<sender-email>
\`\`\`

Never commit `.env` files to version control.
