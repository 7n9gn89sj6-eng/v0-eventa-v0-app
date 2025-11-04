import { test, expect } from "@playwright/test"
import { injectAxe, checkA11y } from "axe-playwright"

test("home renders", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/Eventa/i)
  await expect(page.getByRole("heading")).toBeVisible()
})

test("search API responds", async ({ request }) => {
  const res = await request.post("/api/search", { data: { query: "music" } })
  expect(res.ok()).toBeTruthy()
})

test("homepage has no serious a11y violations", async ({ page }) => {
  await page.goto("/")
  await injectAxe(page)
  await checkA11y(page, undefined, {
    detailedReport: true,
    detailedReportOptions: { html: true },
    axeOptions: { runOnly: ["wcag2a", "wcag2aa"] },
  })
})
