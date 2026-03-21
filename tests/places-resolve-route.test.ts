/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET as resolveGet } from "@/app/api/places/resolve/route"

describe("GET /api/places/resolve", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 400 when id is missing", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "test-token")
    const req = new NextRequest("http://localhost/api/places/resolve")
    const res = await resolveGet(req)
    expect(res.status).toBe(400)
  })
})
