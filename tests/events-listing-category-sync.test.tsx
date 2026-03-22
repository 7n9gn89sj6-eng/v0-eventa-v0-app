/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
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

vi.mock("@/components/search/smart-input-bar", () => ({
  SmartInputBar: () => <div data-testid="smart-input-stub" />,
}))

describe("EventsListingContent category sync from URL", () => {
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
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("updates category chip when initialCategory transitions markets → music", async () => {
    const { rerender } = render(
      <EventsListingContent initialQuery="markets" initialCategory="markets" />,
    )

    await waitFor(() => {
      expect(
        within(screen.getByTestId("discover-interpretation-intent-chip")).getByText("markets"),
      ).toBeTruthy()
    })

    rerender(<EventsListingContent initialQuery="music" initialCategory="music" />)

    await waitFor(() => {
      expect(screen.queryByText("markets")).toBeNull()
      expect(screen.getAllByText("music").length).toBeGreaterThan(0)
    })
  })

  it("does not write stale category=markets to URL when q and category come from new intent", async () => {
    const { rerender } = render(
      <EventsListingContent initialQuery="markets" initialCategory="markets" />,
    )

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())

    routerReplace.mockClear()

    rerender(<EventsListingContent initialQuery="music" initialCategory="music" />)

    await waitFor(() => {
      const calledWithMusic = vi.mocked(fetch).mock.calls.some(
        (c) =>
          String(c[0]).includes("query=music") && String(c[0]).includes("category=music"),
      )
      expect(calledWithMusic).toBe(true)
    })

    await waitFor(() => {
      expect(routerReplace.mock.calls.length).toBeGreaterThan(0)
    })

    const staleCombo = routerReplace.mock.calls.some(([url]) => {
      const s = String(url)
      return s.includes("q=music") && s.includes("category=markets")
    })
    expect(staleCombo).toBe(false)

    const hasMusicCategory = routerReplace.mock.calls.some(([url]) => String(url).includes("category=music"))
    expect(hasMusicCategory).toBe(true)
  })
})
