/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react"
import React from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"

const routerReplace = vi.fn()
const future = new Date("2026-05-01T12:00:00.000Z").toISOString()

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

const effectiveLocation = {
  city: null,
  country: null,
  source: "device" as const,
  region: null,
  scope: "broad",
  countries: null,
}

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

vi.mock("@/components/search/smart-input-bar", () => ({
  SmartInputBar: () => <div data-testid="smart-input-stub" />,
}))

vi.mock("@/components/places/place-autocomplete", () => ({
  PlaceAutocomplete: () => <div data-testid="place-autocomplete-stub" />,
}))

describe("EventsListingContent stale search response", () => {
  beforeEach(() => {
    routerReplace.mockClear()
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it("keeps newer category results when an older in-flight response resolves later", async () => {
    const musicEvent = baseInternal({
      id: "music-1",
      title: "Stale Music Headliner",
      categories: ["Music"],
    })
    const sportsEvent = baseInternal({
      id: "sports-1",
      title: "Fresh Sports Match",
      categories: ["Sports"],
    })

    let releaseFirst: (() => void) | null = null

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
              internal: [sportsEvent],
              external: [],
              count: 1,
              effectiveLocation,
            }),
          })
        }
        return new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
          releaseFirst = () =>
            resolve({
              ok: true,
              json: async () => ({
                internal: [musicEvent],
                external: [],
                count: 1,
                effectiveLocation,
              }),
            })
        })
      }),
    )

    render(<EventsListingContent initialQuery="live shows" initialCategory="Music" />)

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole("button", { name: "filters.show" }))
    const categoryTrigger = await screen.findByLabelText("filters.category")
    fireEvent.click(categoryTrigger)
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Sports" })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("option", { name: "Sports" }))

    await waitFor(() => {
      expect(screen.getByText("Fresh Sports Match")).toBeTruthy()
    })
    expect(screen.queryByText("Stale Music Headliner")).toBeNull()

    expect(releaseFirst).toBeTypeOf("function")
    releaseFirst!()

    await waitFor(() => {
      expect(screen.getByText("Fresh Sports Match")).toBeTruthy()
    })
    expect(screen.queryByText("Stale Music Headliner")).toBeNull()
  })
})
