// scripts/check-env-strict.ts
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"
if (!isCI) process.exit(0)

// Required in CI builds:
const missing: string[] = []
if (!process.env.NEXTAUTH_SECRET) missing.push("NEXTAUTH_SECRET")
if (!process.env.NEXT_PUBLIC_AUTH_ENABLED) missing.push("NEXT_PUBLIC_AUTH_ENABLED")

// Warn-only items (don't fail):
const notes: string[] = []
if (!process.env.DATABASE_URL)
  notes.push("DATABASE_URL is empty — DB features are disabled (this is OK if intentional)")

if (missing.length) {
  console.error(
    `❌ CI env check failed. Missing required env(s): ${missing.join(", ")}.\n` +
      `Set them in your CI/host before deploying.`,
  )
  process.exit(1)
}

if (notes.length) {
  console.log("ℹ️ Notes:\n- " + notes.join("\n- "))
}
console.log("✅ CI env check passed.")
