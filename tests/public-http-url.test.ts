import { describe, it, expect } from "vitest"
import { isPublicHttpUrl } from "@/lib/events/public-http-url"

describe("isPublicHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isPublicHttpUrl("https://cdn.example.com/a.jpg")).toBe(true)
    expect(isPublicHttpUrl("  http://example.com/x.png  ")).toBe(true)
  })
  it("rejects non-http(s) and garbage", () => {
    expect(isPublicHttpUrl("")).toBe(false)
    expect(isPublicHttpUrl("ftp://x.com/a")).toBe(false)
    expect(isPublicHttpUrl("not a url")).toBe(false)
  })
})
