import { test, expect } from "@playwright/test"

test("Eventa UI trust: location switching changes search context (Melbourne -> Berlin)", async ({ page }) => {
  // Seed stored location as Melbourne so LocationContext doesn't try geolocation.
  await page.addInitScript(() => {
    const ts = Date.now()
    localStorage.setItem(
      "eventa.defaultLocation",
      JSON.stringify({
        lat: -37.8136,
        lng: 144.9631,
        city: "Melbourne",
        country: "Australia",
        timestamp: ts,
      }),
    )
  })

  const QUERY = "music this weekend"
  const MELB_TITLE = "Melbourne Music Weekend Fixture"
  const BERLIN_TITLE = "Berlin Music Weekend Fixture"

  // Geocode forward mock: only support Berlin.
  await page.route("**/api/geocode/forward**", async (route) => {
    const reqUrl = new URL(route.request().url())
    const q = (reqUrl.searchParams.get("q") || "").toLowerCase()

    if (q.includes("berlin")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          city: "Berlin",
          country: "Germany",
          lat: 52.52,
          lng: 13.405,
          address: "Berlin, Germany",
        }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "No results found", code: "NO_RESULTS" }),
    })
  })

  // Intent mock: extracted city comes from the active UI location (userLocation).
  await page.route("**/api/search/intent**", async (route) => {
    const raw = route.request().postData()
    let body: any = null
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      body = null
    }

    const query = String(body?.query ?? "")
    const userLocation = body?.userLocation ?? null
    const extractedCity = String(userLocation?.city ?? "Melbourne")
    const extractedCountry = String(userLocation?.country ?? "Australia")

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query,
        extracted: {
          type: "music",
          city: extractedCity,
          country: extractedCountry,
        },
      }),
    })
  })

  // Events mock: return fixture based on `city` query param.
  let interceptedEventRequestUrls: string[] = []
  await page.route("**/api/search/events**", async (route) => {
    const url = new URL(route.request().url())
    const cityParamRaw = url.searchParams.get("city") || ""
    const cityParam = cityParamRaw.toLowerCase()

    interceptedEventRequestUrls.push(url.toString())

    const isBerlin = cityParam.includes("berlin")
    const title = isBerlin ? BERLIN_TITLE : MELB_TITLE
    const city = isBerlin ? "Berlin" : "Melbourne"
    const country = isBerlin ? "Germany" : "Australia"

    const startAt = "2026-01-20T10:00:00.000Z"
    const endAt = "2026-01-20T12:00:00.000Z"

    const musicEvent = {
      id: isBerlin ? "ui-berlin-1" : "ui-melb-1",
      title,
      description: `Fixture: music for ${city}`,
      startAt,
      endAt,
      city,
      country,
      venueName: null,
      address: null,
      categories: ["music"],
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
        events: [musicEvent],
        internal: [musicEvent],
        external: [],
        count: 1,
        total: 1,
        page: 1,
        take: 20,
        query: url.searchParams.get("query") || url.searchParams.get("q") || "",
        emptyState: false,
        includesWeb: false,
        isEventIntent: true,
        effectiveLocation: { city, country, source: "ui" },
      }),
    })
  })

  await page.goto("/discover")

  // Initial state: Melbourne should be the active location in the header.
  await expect(page.getByRole("banner").getByRole("button", { name: /Clear location: Melbourne/i })).toBeVisible()

  const searchInput = page.locator('input[inputmode="search"]').first()

  // Resolve the submit button for fallback (keep it local to the search input row).
  const roleSearchButton = page.getByRole("button", { name: /search/i })
  const roleCount = await roleSearchButton.count()

  const searchRow = page
    .locator('div.relative.flex.flex-col.gap-2.sm\\:flex-row')
    .filter({ has: searchInput })
    .first()

  const fallbackSubmitButton = searchRow.locator('button[type="button"]').last()
  const searchButton = roleCount > 0 ? roleSearchButton.first() : fallbackSubmitButton

  // Primary: press Enter; short wait for URL q update; fallback click if needed.
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
      { timeout: 10_000 },
    )
  }

  // 1) Search: expect Melbourne fixture.
  interceptedEventRequestUrls = []
  await searchInput.fill(QUERY)
  await submitWithEnterFallback(QUERY)
  await expect(page.getByText(MELB_TITLE)).toBeVisible()
  await expect(page.getByText(BERLIN_TITLE)).toHaveCount(0)

  // 2) Switch UI location to Berlin.
  await page.getByRole("button", { name: /Enter city/i }).click()
  await page.locator("#header-city-input").fill("Berlin")
  await page.getByRole("button", { name: /Set location/i }).click()

  await expect(page.getByRole("banner").getByRole("button", { name: /Clear location: Berlin/i })).toBeVisible()

  // 3) Re-run search: expect Berlin fixture + no Melbourne leakage.
  interceptedEventRequestUrls = []
  await searchInput.fill(QUERY)
  await submitWithEnterFallback(QUERY)
  await expect(page.getByText(BERLIN_TITLE)).toBeVisible()
  await expect(page.getByText(MELB_TITLE)).toHaveCount(0)

  const lastEventRequestUrl = interceptedEventRequestUrls[interceptedEventRequestUrls.length - 1] || ""
  const lastCity = new URL(lastEventRequestUrl || "http://x").searchParams.get("city")
  expect(String(lastCity || "").toLowerCase()).toContain("berlin")
})

