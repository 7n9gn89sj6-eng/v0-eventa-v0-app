import { describe, it, expect } from "vitest"
import {
  publicLiveListingWhere,
  isPublicLiveListing,
  isPastPublicLiveListing,
} from "@/lib/events"

describe("public live listing helpers", () => {
  const t = new Date("2026-06-15T12:00:00.000Z")
  const base = { status: "PUBLISHED" as const, moderationStatus: "APPROVED", endAt: new Date("2026-06-20T12:00:00.000Z") }

  it("publicLiveListingWhere includes endAt gte", () => {
    const w = publicLiveListingWhere(t)
    expect(w.endAt).toEqual({gte: t})
    expect(w.status).toBe("PUBLISHED")
    expect(w.moderationStatus).toBe("APPROVED")
  })

  it("isPublicLiveListing true when still running", () => {
    expect(isPublicLiveListing(base, t)).toBe(true)
  })

  it("isPastPublicLiveListing true after endAt", () => {
    const after = new Date("2026-06-21T12:00:00.000Z")
    expect(isPastPublicLiveListing(base, after)).toBe(true)
  })

  it("isPastPublicLiveListing false for rejected (not approved)", () => {
    const rej = { ...base, moderationStatus: "REJECTED" }
    const after = new Date("2026-06-21T12:00:00.000Z")
    expect(isPastPublicLiveListing(rej, after)).toBe(false)
  })
})
