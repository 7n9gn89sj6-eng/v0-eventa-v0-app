/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET as suggestGet, POST as suggestPost } from "@/app/api/places/suggest/route"

const forwardMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/places/mapbox-places-fetch", () => ({
  mapboxPlacesForwardSuggest: forwardMock,
  mapboxPlacesRetrieveById: vi.fn(),
}))

describe("/api/places/suggest", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    forwardMock.mockReset()
    vi.restoreAllMocks()
  })

  it("POST returns 200 with empty suggestions when forward yields no results (e.g. missing token path)", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "")
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "")
    forwardMock.mockResolvedValueOnce([])
    const req = new Request("http://localhost/api/places/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: "Melbourne" }),
    })
    const res = await suggestPost(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.suggestions).toEqual([])
  })

  it("GET ?q= returns 200 with empty suggestions when forward yields no results", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "")
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "")
    forwardMock.mockResolvedValueOnce([])
    const req = new NextRequest("http://localhost/api/places/suggest?q=Melbourne")
    const res = await suggestGet(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.suggestions).toEqual([])
  })
})
