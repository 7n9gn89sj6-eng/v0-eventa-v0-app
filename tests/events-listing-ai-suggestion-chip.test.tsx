/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { discoverUrlSearchParamsStringFromProps } from "./support/discover-url-search-params-string"

const mockDiscoverSearch = vi.hoisted(() => ({ s: "" }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
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
    t: () => (key: string, vars: Record<string, string | number> = {}) => {
      if (key.includes("aiSuggestionTooltip")) return `tooltip:${vars.suggestion ?? ""}`
      if (key.includes("aiSuggestionAria")) return `aria:${vars.suggestion ?? ""}`
      if (key.includes("aiSuggestionLowConfidence")) return "LOW_CONF"
      return key
    },
  }),
}))

vi.mock("@/components/search/smart-input-bar", () => ({
  SmartInputBar: () => <div data-testid="smart-input-stub" />,
}))

describe("EventsListingContent AI suggestion chip", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          internal: [],
          external: [],
          count: 0,
          events: [],
          effectiveLocation: { city: null, country: null, source: "device" },
          phase1Interpretation: {
            schemaVersion: 1,
            meta: { aiAttempted: true, aiSucceeded: true },
            facets: [
              {
                kind: "ai_suggestion",
                displayLabel: "Suggested: food (not used for results)",
                confidence: 0.5,
              },
            ],
          },
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders optional ai_suggestion chip below interpretation strip with tooltip when confidence is low", async () => {
    mockDiscoverSearch.s = discoverUrlSearchParamsStringFromProps({ initialQuery: "markets" })
    render(<EventsListingContent initialQuery="markets" />)

    await waitFor(() => {
      expect(screen.getByTestId("discover-interpretation-ai-suggestion-chip")).toBeTruthy()
    })

    const chip = screen.getByTestId("discover-interpretation-ai-suggestion-chip")
    expect(chip.textContent).toContain("Suggested: food (not used for results)")
    expect(chip.getAttribute("title")).toContain("LOW_CONF")
    expect(chip.getAttribute("aria-label")).toContain("LOW_CONF")
  })
})
