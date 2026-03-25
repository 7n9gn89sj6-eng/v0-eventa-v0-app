/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, waitFor } from "@testing-library/react"
import React from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { discoverUrlSearchParamsStringFromProps } from "./support/discover-url-search-params-string"

const routerReplace = vi.fn()
const mockDiscoverSearch = vi.hoisted(() => ({ s: "" }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(mockDiscoverSearch.s),
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

vi.mock("@/components/search/smart-input-bar", () => ({
  SmartInputBar: () => <div data-testid="smart-input-stub" />,
}))

vi.mock("@/components/places/place-autocomplete", () => ({
  PlaceAutocomplete: () => <div data-testid="place-autocomplete-stub" />,
}))

describe("Discover URL SSOT (no stale city/dates after new search navigation)", () => {
  beforeEach(() => {
    routerReplace.mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          internal: [],
          external: [],
          count: 0,
          events: [],
          effectiveLocation: {
            city: null,
            country: null,
            source: "device",
            region: null,
            scope: "broad",
            countries: null,
          },
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("after Sydney weekend, Melbourne comedy fetch uses Melbourne and drops date range when URL has no dates", async () => {
    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "weekend",
      initialCity: "Sydney",
      initialCountry: "Australia",
      initialDateFrom: "2026-03-20T00:00:00.000Z",
      initialDateTo: "2026-03-22T23:59:59.999Z",
    })

    const { rerender } = render(
      <EventsListingContent
        initialQuery="weekend"
        initialCity="Sydney"
        initialCountry="Australia"
      />,
    )

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    const sydneyUrl = String(vi.mocked(fetch).mock.calls[0][0])
    expect(sydneyUrl).toContain("city=Sydney")
    expect(sydneyUrl).toContain("date_from")

    vi.mocked(fetch).mockClear()

    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "Melbourne International Comedy Festival",
      initialCity: "Melbourne",
      initialCountry: "Australia",
    })

    rerender(
      <EventsListingContent
        initialQuery="Melbourne International Comedy Festival"
        initialCity="Melbourne"
        initialCountry="Australia"
      />,
    )

    await waitFor(() => {
      const last = String(vi.mocked(fetch).mock.calls.at(-1)?.[0] ?? "")
      expect(last).toContain("city=Melbourne")
      expect(last).not.toContain("date_from")
      expect(last).not.toContain("date_to")
      expect(last).toContain("Melbourne")
    })
  })
})
