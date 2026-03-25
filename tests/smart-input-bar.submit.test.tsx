/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react"
import React from "react"
import { SmartInputBar } from "@/components/search/smart-input-bar"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock("@/lib/i18n/context", () => ({
  useI18n: () => ({
    t: () => (key: string) => key,
  }),
}))

vi.mock("@/lib/location-context", () => ({
  useLocation: () => ({
    defaultLocation: null,
    isLoadingLocation: false,
    clearDefaultLocation: vi.fn(),
    requestUserLocation: vi.fn(),
  }),
}))

/** `q` in router.push uses + for spaces; decodeURIComponent alone does not decode `+`. */
function decodeDiscoverQParam(url: string): string {
  const m = url.match(/[?&]q=([^&]*)/)
  if (!m) return ""
  return decodeURIComponent(m[1]!.replace(/\+/g, " "))
}

describe("SmartInputBar submit", () => {
  beforeEach(() => {
    pushMock.mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: "stub",
          extracted: {},
        }),
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("Go click uses input text and never produces [object Object] in navigation or parent callback", async () => {
    const onSearch = vi.fn()
    render(<SmartInputBar onSearch={onSearch} initialQuery="" />)

    const input = screen.getByPlaceholderText("search.searchGuidance")
    fireEvent.change(input, { target: { value: "London theatre" } })

    fireEvent.click(screen.getByTestId("smart-input-go"))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled()
    })

    const url = pushMock.mock.calls[0]?.[0] as string
    expect(url).toContain("/discover?")
    expect(url).toContain("q=")
    expect(url).not.toContain("object+Object")
    expect(url).not.toContain("[object")
    expect(decodeDiscoverQParam(url)).toBe("London theatre")

    expect(onSearch).toHaveBeenCalledWith("London theatre")
    expect((input as HTMLInputElement).value).toBe("London theatre")
  })

  it("Enter key submits the same as Go", async () => {
    const onSearch = vi.fn()
    render(<SmartInputBar onSearch={onSearch} initialQuery="" />)

    const input = screen.getByPlaceholderText("search.searchGuidance")
    fireEvent.change(input, { target: { value: "live music Sydney" } })
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 })

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled()
    })

    const url = pushMock.mock.calls[0]?.[0] as string
    expect(decodeDiscoverQParam(url)).toBe("live music Sydney")
    expect(onSearch).toHaveBeenCalledWith("live music Sydney")
  })

  it("Try-these pill submits that suggestion string", async () => {
    const onSearch = vi.fn()
    render(<SmartInputBar onSearch={onSearch} initialQuery="" alwaysShowSuggestions />)

    const pills = screen.getAllByTestId("smart-input-try-these-option")
    expect(pills.length).toBeGreaterThan(0)
    const label = pills[0]!.getAttribute("data-suggestion") ?? ""
    expect(label.length).toBeGreaterThan(0)

    fireEvent.click(pills[0]!)

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled()
      expect(onSearch).toHaveBeenCalledWith(label)
    })
    const url = pushMock.mock.calls[0]?.[0] as string
    expect(decodeDiscoverQParam(url)).toBe(label)
  })
})
