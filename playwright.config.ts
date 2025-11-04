import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  webServer: {
    command: "PORT=3001 next dev",
    port: 3001,
    timeout: 60_000,
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:3001" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
