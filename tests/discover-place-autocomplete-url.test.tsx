/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react"
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

describe("Discover PlaceAutocomplete → URL", () => {
  beforeEach(() => {
    routerReplace.mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/api/places/suggest")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                suggestions: [
                  { id: "place.disc", label: "Sydney, NSW, Australia", primary: "Sydney" },
                ],
              }),
          })
        }
        if (url.includes("/api/places/resolve")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                place: {
                  provider: "mapbox",
                  placeId: "place.disc",
                  formattedAddress: "Sydney, NSW, Australia",
                  city: "Sydney",
                  country: "Australia",
                  region: "New South Wales",
                  parentCity: null,
                  lat: -33.86,
                  lng: 151.2,
                },
              }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              internal: [],
              external: [],
              count: 0,
              total: 0,
              emptyState: true,
              includesWeb: false,
              isEventIntent: false,
            }),
        })
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("writes city and country into router.replace after selecting a place", async () => {
    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "",
      initialCategory: "All",
    })
    render(<EventsListingContent initialQuery="" initialCategory="All" />)

    fireEvent.click(screen.getByText("filters.show"))

    const root = await screen.findByTestId("discover-place-autocomplete")
    const input = root.querySelector('[role="combobox"]') as HTMLInputElement
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { value: "Syd" } })

    await waitFor(
      () => {
        expect(screen.getByText("Sydney, NSW, Australia")).toBeTruthy()
      },
      { timeout: 3000 },
    )

    fireEvent.click(screen.getByText("Sydney, NSW, Australia"))

    await waitFor(
      () => {
        const call = routerReplace.mock.calls.find((c) => {
          const u = String(c[0])
          return u.includes("city=Sydney") && u.includes("country=Australia")
        })
        expect(call).toBeTruthy()
      },
      { timeout: 4000 },
    )
  })

  it("seeds location combobox from URL initial city and country", async () => {
    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "",
      initialCategory: "All",
      initialCity: "Melbourne",
      initialCountry: "Australia",
    })
    render(
      <EventsListingContent
        initialQuery=""
        initialCategory="All"
        initialCity="Melbourne"
        initialCountry="Australia"
      />,
    )

    fireEvent.click(screen.getByText("filters.show"))

    const root = await screen.findByTestId("discover-place-autocomplete")
    const input = root.querySelector('[role="combobox"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe("Melbourne, Australia")
  })
})
