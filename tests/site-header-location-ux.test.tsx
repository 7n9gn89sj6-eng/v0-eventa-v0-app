/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import React from "react"
import { SiteHeader } from "@/components/layout/site-header"

const getUserLocationMock = vi.fn<[], ReturnType<typeof import("@/lib/user-location").getUserLocation>>()

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

vi.mock("@/components/auth/user-nav", () => ({
  UserNav: () => <div data-testid="user-nav-stub" />,
}))

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="lang-stub" />,
}))

vi.mock("@/lib/user-location", () => ({
  getUserLocation: () => getUserLocationMock(),
}))

const mockUseLocation = vi.fn()

vi.mock("@/lib/location-context", () => ({
  useLocation: () => mockUseLocation(),
}))

function baseLocationMock(overrides: Partial<ReturnType<typeof mockUseLocation>> = {}) {
  return {
    defaultLocation: null,
    isLoadingLocation: false,
    clearDefaultLocation: vi.fn(),
    setDefaultLocation: vi.fn(),
    requestUserLocation: vi.fn().mockResolvedValue({ success: true, errorCode: null }),
    lastLocationError: null as string | null,
    setLastLocationError: vi.fn(),
    ...overrides,
  }
}

describe("SiteHeader location failure UX", () => {
  beforeEach(() => {
    getUserLocationMock.mockReturnValue(null)
    mockUseLocation.mockReturnValue(baseLocationMock())
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("shows desktop hint when geolocation failed (lastLocationError set)", async () => {
    mockUseLocation.mockReturnValue(
      baseLocationMock({
        lastLocationError:
          "We couldn't determine your location right now (e.g. GPS off or weak signal). You can still search by city name.",
      }),
    )

    render(<SiteHeader />)

    const banner = screen.getByTestId("location-error-banner")
    const hint = within(banner).getByTestId("location-failure-hint")
    expect(hint.textContent).toMatch(/unreliable on some desktops/i)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Berlin, London/i)).toBeTruthy()
    })
  })

  it("opens manual entry with stored city prefill when available", async () => {
    getUserLocationMock.mockReturnValue({
      lat: -37,
      lng: 145,
      city: "Melbourne",
      country: "Australia",
      timestamp: Date.now(),
    })

    mockUseLocation.mockReturnValue(
      baseLocationMock({
        lastLocationError: "Location request timed out. You can still search by city name.",
      }),
    )

    render(<SiteHeader />)

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Berlin, London/i) as HTMLInputElement
      expect(input.value).toContain("Melbourne")
    })
  })

  it("banner Enter city focuses manual entry (popover usable)", async () => {
    mockUseLocation.mockReturnValue(
      baseLocationMock({
        lastLocationError: "We couldn't determine your location. You can still search by city name.",
      }),
    )

    render(<SiteHeader />)

    const banner = screen.getByTestId("location-error-banner")
    const enterInBanner = within(banner).getByRole("button", { name: /^Enter city$/i })
    fireEvent.click(enterInBanner)

    const input = (await screen.findByPlaceholderText(/Berlin, London/i)) as HTMLInputElement
    await waitFor(() => {
      expect(document.activeElement).toBe(input)
    })

    expect(console.log).toHaveBeenCalledWith(
      "[LocationUX] manual_entry_opened",
      expect.objectContaining({ source: "banner_cta" }),
    )
  })

  it("no failure hint when geolocation succeeded (no lastLocationError)", () => {
    mockUseLocation.mockReturnValue(
      baseLocationMock({
        defaultLocation: { city: "Berlin", country: "Germany", source: "manual" },
      }),
    )

    render(<SiteHeader />)

    expect(screen.queryByTestId("location-failure-hint")).toBeNull()
  })
})
