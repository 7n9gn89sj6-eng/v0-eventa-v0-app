/** Env-only: safe to import from RSC pages without pulling Prisma / NextAuth options. */
export const adminCredentialsConfigured = !!(
  process.env.ADMIN_EMAIL?.trim() &&
  process.env.ADMIN_PASSWORD &&
  process.env.ADMIN_PASSWORD.length > 0
)
