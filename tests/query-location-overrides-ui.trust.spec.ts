import { test, expect } from "@playwright/test"

test("Eventa UI trust: query location overrides selected location", async ({ page }) => {
  // Seed selected UI location as Brunswick, Australia.
  await page.addInitScript(() => {
    const ts = Date.now()
    localStorage.setItem(
      "eventa.defaultLocation",
      JSON.stringify({
        lat: -37.765,
        lng: 144.962,
        city: "Brunswick",
        country: "Australia",
        timestamp: ts,
      }),
    )
  })

  const QUERY = "garage sale Berlin"
  const BERLIN_TITLE = "Berlin Fixture"
  const BRUNSWICK_TITLE = "Brunswick Fixture"

  // Deterministic intent extraction: explicit query location should be Berlin.
  await page.route("**/api/search/intent**", async (route) => {
    const raw = route.request().postData()
    let body: any = null
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      body = null
    }
    const query = String(body?.query ?? "")

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query,
        extracted: {
          type: "markets",
          city: "Berlin",
          country: "Germany",
        },
      }),
    })
  })

  // Events fixture by requested city.
  const interceptedEventRequestUrls: string[] = []
  await page.route("**/api/search/events**", async (route) => {
    const reqUrl = new URL(route.request().url())
    interceptedEventRequestUrls.push(reqUrl.toString())

    const cityParam = (reqUrl.searchParams.get("city") || "").toLowerCase()
    const isBerlin = cityParam.includes("berlin")

    const title = isBerlin ? BERLIN_TITLE : BRUNSWICK_TITLE
    const city = isBerlin ? "Berlin" : "Brunswick"
    const country = isBerlin ? "Germany" : "Australia"

    const fixture = {
      id: isBerlin ? "berlin-1" : "brunswick-1",
      title,
      description: `Fixture for ${city}`,
      startAt: "2026-01-20T10:00:00.000Z",
      endAt: "2026-01-20T12:00:00.000Z",
      city,
      country,
      venueName: null,
      address: null,
      categories: ["markets"],
      priceFree: false,
      imageUrls: [],
      status: "PUBLISHED",
      aiStatus: "SAFE",
      source: "internal",
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [fixture],
        internal: [fixture],
        external: [],
        count: 1,
        total: 1,
        page: 1,
        take: 20,
        query: reqUrl.searchParams.get("query") || reqUrl.searchParams.get("q") || "",
        emptyState: false,
        includesWeb: false,
        isEventIntent: true,
        effectiveLocation: {
          city,
          country,
          source: isBerlin ? "query" : "ui",
        },
      }),
    })
  })

  await page.goto("/discover")

  const searchInput = page.locator('input[inputmode="search"]').first()

  const roleSearchButton = page.getByRole("button", { name: /search/i })
  const roleCount = await roleSearchButton.count()
  const searchRow = page
    .locator('div.relative.flex.flex-col.gap-2.sm\\:flex-row')
    .filter({ has: searchInput })
    .first()
  const fallbackSubmitButton = searchRow.locator('button[type="button"]').last()
  const searchButton = roleCount > 0 ? roleSearchButton.first() : fallbackSubmitButton

  const submitWithEnterFallback = async (expectedQ: string) => {
    await searchInput.press("Enter")
    const updated = await page
      .waitForFunction(
        (q) => new URL(window.location.href).searchParams.get("q") === q,
        expectedQ,
        { timeout: 2000 },
      )
      .then(() => true)
      .catch(() => false)

    if (!updated) {
      await searchButton.click()
    }

    await page.waitForFunction(
      (q) => new URL(window.location.href).searchParams.get("q") === q,
      expectedQ,
      { timeout: 10000 },
    )
  }

  await searchInput.fill(QUERY)
  await submitWithEnterFallback(QUERY)

  // Assertions: query location (Berlin) must win over selected UI location (Brunswick).
  await expect(page.getByText(BERLIN_TITLE)).toBeVisible()
  await expect(page.getByText(BRUNSWICK_TITLE)).toHaveCount(0)

  const lastReq = interceptedEventRequestUrls[interceptedEventRequestUrls.length - 1] || ""
  const requestedCity = new URL(lastReq || "http://x").searchParams.get("city") || ""
  expect(requestedCity.toLowerCase()).toContain("berlin")
})

