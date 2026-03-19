import { test, expect } from "@playwright/test"

test("Eventa search UI sync: second search replaces first (music -> food in brunswick)", async ({
  page,
}) => {
  // Seed stored location so LocationContext does not attempt geolocation.
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

  const MUSIC_TITLE = "Music Fixture Event"
  const FOOD_TITLE = "Food Brunswick Fixture Event"

  // Deterministic intent extraction (avoid OpenAI/external services).
  await page.route("**/api/search/intent", async (route) => {
    const raw = route.request().postData()
    let body: any = null
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      body = null
    }
    const query = String(body?.query ?? "")
    const normalized = query.toLowerCase().trim()

    const type = normalized.includes("food") ? "food" : "music"
    const city = normalized.includes("brunswick") ? "Brunswick" : "Melbourne"
    const country = "Australia"

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query,
        extracted: { type, city, country },
      }),
    })
  })

  // Deterministic events based on the request URL.
  // This catches stale client state: if the second search keeps `music`, the UI will still show MUSIC_TITLE.
  const interceptedEventRequestUrls: string[] = []
  await page.route("**/api/search/events**", async (route) => {
    const interceptedUrl = route.request().url()
    console.log("[ui-sync-test] intercepted /api/search/events:", interceptedUrl)
    interceptedEventRequestUrls.push(interceptedUrl)

    const url = new URL(interceptedUrl)
    const q = url.searchParams.get("query") || url.searchParams.get("q") || ""
    const category = (url.searchParams.get("category") || "").toLowerCase()
    const city = url.searchParams.get("city") || ""
    const country = url.searchParams.get("country") || ""

    const startAt = "2026-01-20T10:00:00.000Z"
    const endAt = "2026-01-20T12:00:00.000Z"

    const musicEvent = {
      id: "ui-music-1",
      title: MUSIC_TITLE,
      description: "Fixture: music results",
      startAt,
      endAt,
      city: city || "Melbourne",
      country: country || "Australia",
      venueName: null,
      address: null,
      categories: ["music"],
      priceFree: false,
      imageUrls: [],
      status: "PUBLISHED",
      aiStatus: "SAFE",
      source: "internal",
    }

    const foodEvent = {
      id: "ui-food-1",
      title: FOOD_TITLE,
      description: "Fixture: food results",
      startAt,
      endAt,
      city: city || "Brunswick",
      country: country || "Australia",
      venueName: null,
      address: null,
      categories: ["food"],
      priceFree: false,
      imageUrls: [],
      status: "PUBLISHED",
      aiStatus: "SAFE",
      source: "internal",
    }

    const qLower = q.toLowerCase()
    let internal: any[] = []

    if (category) {
      if (category.includes("food")) internal = [foodEvent]
      else if (category.includes("music")) internal = [musicEvent]
    } else if (qLower.includes("food")) {
      internal = [foodEvent]
    } else if (qLower.includes("music")) {
      internal = [musicEvent]
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: internal,
        internal,
        external: [],
        count: internal.length,
        total: internal.length,
        page: 1,
        take: 20,
        query: q,
        emptyState: internal.length === 0,
        includesWeb: false,
        isEventIntent: true,
        effectiveLocation: { city: city || null, country: country || null, source: "ui" },
      }),
    })
  })

  await page.goto("/discover")

  const searchInput = page.locator('input[inputmode="search"]').first()

  // Prefer role/name-based selector; fall back to the "search" button in the same top row
  // as the input (avoid clicking example chips further down).
  const roleSearchButton = page.getByRole("button", { name: /search/i })
  const roleCount = await roleSearchButton.count()

  const searchRow = page
    .locator('div.relative.flex.flex-col.gap-2.sm\\:flex-row')
    .filter({ has: searchInput })
    .first()

  const fallbackSubmitButton = searchRow.locator('button[type="button"]').last()

  const searchButton = roleCount > 0 ? roleSearchButton.first() : fallbackSubmitButton

  const assertSearch = async (expectedQ: string, expectedTitle: string) => {
    await page.waitForFunction(
      (q) => new URL(window.location.href).searchParams.get("q") === q,
      expectedQ,
    )
    await expect(page.getByText(expectedTitle)).toBeVisible()
  }

  const submitWithEnterFallback = async (expectedQ: string, expectedTitle: string) => {
    await searchInput.press("Enter")

    // If Enter doesn't trigger submission quickly, fall back to the submit button.
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

    await assertSearch(expectedQ, expectedTitle)
  }

  // 1) Search for `music`
  await searchInput.fill("music")
  await submitWithEnterFallback("music", MUSIC_TITLE)
  expect(interceptedEventRequestUrls.length).toBeGreaterThan(0)

  // 2) Search for `food in brunswick`
  await searchInput.fill("food in brunswick")
  await submitWithEnterFallback("food in brunswick", FOOD_TITLE)
  expect(interceptedEventRequestUrls.length).toBeGreaterThan(0)

  // Trust assertions: second search replaced the first.
  await expect(page.locator(`text=${MUSIC_TITLE}`)).toHaveCount(0)
})

