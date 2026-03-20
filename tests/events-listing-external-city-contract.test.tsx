/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"

const routerReplace = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/lib/i18n/context", () => ({
  useI18n: () => ({
    t: () => (key: string) => key,
  }),
}))

vi.mock("@/lib/location-context", () => ({
  useLocation: () => ({
    defaultLocation: undefined,
    isLoadingLocation: false,
    clearDefaultLocation: vi.fn(),
    requestUserLocation: vi.fn(),
  }),
}))

vi.mock("@/components/search/smart-input-bar", () => ({
  SmartInputBar: () => <div data-testid="smart-input-stub" />,
}))

describe("EventsListingContent external city vs API effectiveLocation", () => {
  beforeEach(() => {
    routerReplace.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps Melbourne web rows when URL chip is Brunswick but API widened effectiveLocation to Melbourne", async () => {
    const future = new Date("2026-04-01T12:00:00.000Z").toISOString()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          internal: [],
          external: [
            {
              id: "web-melb",
              title: "Northside Gig Guide",
              description: "Live listings",
              startAt: future,
              endAt: future,
              city: "Melbourne",
              country: "Australia",
              location: { city: "Melbourne", country: "Australia" },
              categories: [] as string[],
              source: "web",
              externalUrl: "https://example.com/gigs",
            },
          ],
          count: 1,
          total: 1,
          emptyState: false,
          includesWeb: true,
          isEventIntent: true,
          effectiveLocation: {
            city: "Melbourne",
            country: "Australia",
            region: null,
            countries: null,
            scope: "local",
            source: "ui",
          },
        }),
      }),
    )

    render(
      <EventsListingContent
        initialQuery="Music near me"
        initialCity="Brunswick"
        initialCountry="Australia"
        initialCategory="All"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("Northside Gig Guide")).toBeTruthy()
    })
  })

  it("uses query destination city for externals when effectiveLocation.source is query (strict explicit place)", async () => {
    const future = new Date("2026-04-01T12:00:00.000Z").toISOString()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          internal: [],
          external: [
            {
              id: "web-berlin",
              title: "Berlin Night",
              description: "Club night",
              startAt: future,
              endAt: future,
              city: "Berlin",
              country: "Germany",
              location: { city: "Berlin", country: "Germany" },
              categories: [] as string[],
              source: "web",
              externalUrl: "https://example.com/berlin",
            },
          ],
          count: 1,
          total: 1,
          emptyState: false,
          includesWeb: true,
          isEventIntent: true,
          effectiveLocation: {
            city: "Berlin",
            country: "Germany",
            region: null,
            countries: null,
            scope: "city",
            source: "query",
          },
        }),
      }),
    )

    render(
      <EventsListingContent
        initialQuery="music in Berlin"
        initialCity="Melbourne"
        initialCountry="Australia"
        initialCategory="All"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("Berlin Night")).toBeTruthy()
    })
  })
})
