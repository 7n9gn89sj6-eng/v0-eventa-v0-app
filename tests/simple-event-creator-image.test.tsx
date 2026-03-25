/** @vitest-environment happy-dom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react"
import { SimpleEventCreator } from "@/components/events/simple-event-creator"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

describe("SimpleEventCreator poster / imageUrl", () => {
  beforeEach(() => {
    pushMock.mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://cdn.example.test/events/abc.jpg" }),
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("sets imageUrl from successful upload response", async () => {
    render(<SimpleEventCreator />)
    const fileInput = screen.getByTestId("event-poster-input") as HTMLInputElement
    const file = new File([new Uint8Array(100)], "flyer.jpg", { type: "image/jpeg" })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      const el = screen.getByTestId("event-image-url-fallback") as HTMLInputElement
      expect(el.value).toBe("https://cdn.example.test/events/abc.jpg")
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/events/event-image",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("sets imageUrl when user uses the link fallback", () => {
    render(<SimpleEventCreator />)
    const urlInput = screen.getByTestId("event-image-url-fallback") as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: "https://images.example.com/poster.webp" } })
    expect(urlInput.value).toBe("https://images.example.com/poster.webp")
  })
})
