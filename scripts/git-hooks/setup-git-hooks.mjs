import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const repoRoot = process.cwd()
const hooksPath = path.join(repoRoot, ".githooks")
const hookFile = path.join(hooksPath, "pre-push")

function tryRun(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" })
  } catch {
    // If git isn't available, or repo isn't writable, just skip setup.
  }
}

// Ensure hook exists + is executable.
try {
  if (fs.existsSync(hookFile)) {
    fs.chmodSync(hookFile, 0o755)
  }
} catch {
  // Ignore chmod failures.
}

// Enable repo-local hooks.
tryRun("git config core.hooksPath .githooks")

