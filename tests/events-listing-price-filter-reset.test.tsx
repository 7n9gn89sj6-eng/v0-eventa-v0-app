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
const future = new Date("2026-04-01T12:00:00.000Z").toISOString()

function baseInternal(overrides: Record<string, unknown>) {
  return {
    id: "e1",
    description: "",
    startAt: future,
    endAt: future,
    city: "Town",
    country: "Place",
    imageUrls: [] as string[],
    status: "PUBLISHED",
    aiStatus: "SAFE",
    ...overrides,
  }
}

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

describe("EventsListingContent selectedPriceFilter reset", () => {
  beforeEach(() => {
    routerReplace.mockClear()
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it("clears hidden price filter when category changes (paid events visible again)", async () => {
    const freeMusic = baseInternal({
      id: "m-free",
      title: "Free Music Night",
      categories: ["Music"],
      priceFree: true,
    })
    const paidMusic = baseInternal({
      id: "m-paid",
      title: "Paid Music Show",
      categories: ["Music"],
      priceFree: false,
    })
    const paidSports = baseInternal({
      id: "s-paid",
      title: "Paid Sports Match",
      categories: ["Sports"],
      priceFree: false,
    })

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        if (!url.includes("/api/search/events")) {
          return Promise.resolve({ ok: true, json: async () => ({}) })
        }
        if (url.includes("category=sports")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              internal: [paidSports],
              external: [],
              count: 1,
              effectiveLocation: {
                city: null,
                country: null,
                source: "device",
                region: null,
                scope: "broad",
                countries: null,
              },
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            internal: [freeMusic, paidMusic],
            external: [],
            count: 2,
            effectiveLocation: {
              city: null,
              country: null,
              source: "device",
              region: null,
              scope: "broad",
              countries: null,
            },
          }),
        })
      }),
    )

    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "gigs",
      initialCategory: "Music",
    })
    render(
      <EventsListingContent initialQuery="gigs" initialCategory="Music" />,
    )

    await waitFor(() => {
      expect(screen.getByText("Free Music Night")).toBeTruthy()
      expect(screen.getByText("Paid Music Show")).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "filters.show" }))

    const priceTrigger = await screen.findByLabelText("filters.price")
    fireEvent.click(priceTrigger)
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "priceOptions.free" })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("option", { name: "priceOptions.free" }))

    await waitFor(() => {
      expect(screen.queryByText("Paid Music Show")).toBeNull()
      expect(screen.getByText("Free Music Night")).toBeTruthy()
    })

    const categoryTrigger = screen.getByLabelText("filters.category")
    fireEvent.click(categoryTrigger)
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Sports" })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("option", { name: "Sports" }))

    await waitFor(() => {
      expect(screen.getByText("Paid Sports Match")).toBeTruthy()
    })
  })

  it("clears hidden price filter when initialQuery changes", async () => {
    const freeA = baseInternal({
      id: "a-free",
      title: "Alpha Free",
      categories: ["Music"],
      priceFree: true,
    })
    const paidA = baseInternal({
      id: "a-paid",
      title: "Alpha Paid",
      categories: ["Music"],
      priceFree: false,
    })
    const paidB = baseInternal({
      id: "b-paid",
      title: "Beta Paid Only",
      categories: ["Music"],
      priceFree: false,
    })

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        if (!url.includes("/api/search/events")) {
          return Promise.resolve({ ok: true, json: async () => ({}) })
        }
        if (url.includes("query=betaq") || url.includes("query=betaq&")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              internal: [paidB],
              external: [],
              count: 1,
              effectiveLocation: {
                city: null,
                country: null,
                source: "device",
                region: null,
                scope: "broad",
                countries: null,
              },
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            internal: [freeA, paidA],
            external: [],
            count: 2,
            effectiveLocation: {
              city: null,
              country: null,
              source: "device",
              region: null,
              scope: "broad",
              countries: null,
            },
          }),
        })
      }),
    )

    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "alphaq",
      initialCategory: "Music",
    })
    const { rerender } = render(
      <EventsListingContent initialQuery="alphaq" initialCategory="Music" />,
    )

    await waitFor(() => {
      expect(screen.getByText("Alpha Free")).toBeTruthy()
      expect(screen.getByText("Alpha Paid")).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "filters.show" }))

    const priceTrigger = await screen.findByLabelText("filters.price")
    fireEvent.click(priceTrigger)
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "priceOptions.free" })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("option", { name: "priceOptions.free" }))

    await waitFor(() => {
      expect(screen.queryByText("Alpha Paid")).toBeNull()
    })

    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "betaq",
      initialCategory: "Music",
    })
    rerender(<EventsListingContent initialQuery="betaq" initialCategory="Music" />)

    await waitFor(() => {
      expect(screen.getByText("Beta Paid Only")).toBeTruthy()
    })
  })

  it("still passes date_from to API when only category changes", async () => {
    const dateFrom = "2026-06-15T00:00:00.000Z"
    const dateTo = "2026-06-20T23:59:59.999Z"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          internal: [],
          external: [],
          count: 0,
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

    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "events",
      initialCategory: "Music",
      initialDateFrom: dateFrom,
      initialDateTo: dateTo,
    })
    const { rerender } = render(
      <EventsListingContent initialQuery="events" initialCategory="Music" />,
    )

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    const firstUrl = String(vi.mocked(fetch).mock.calls[0][0])
    expect(firstUrl).toContain("date_from")
    expect(firstUrl).toContain(encodeURIComponent(dateFrom))

    vi.mocked(fetch).mockClear()

    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({
      initialQuery: "events",
      initialCategory: "Sports",
      initialDateFrom: dateFrom,
      initialDateTo: dateTo,
    })
    rerender(<EventsListingContent initialQuery="events" initialCategory="Sports" />)

    await waitFor(() => {
      const last = String(vi.mocked(fetch).mock.calls.at(-1)?.[0] ?? "")
      expect(last).toContain("date_from")
      expect(last).toContain(encodeURIComponent(dateFrom))
      expect(last).toContain("category=sports")
    })
  })
})
