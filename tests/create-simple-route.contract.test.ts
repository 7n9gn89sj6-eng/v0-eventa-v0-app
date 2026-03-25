import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

let lastSubmitBody: Record<string, unknown> | null = null

vi.mock("@/app/api/events/submit/route", () => ({
  POST: vi.fn(async (req: Request) => {
    lastSubmitBody = (await req.json()) as Record<string, unknown>
    return NextResponse.json({ ok: true, eventId: "evt_contract_test", emailSent: false })
  }),
}))

describe("POST /api/events/create-simple contract", () => {
  beforeEach(() => {
    lastSubmitBody = null
    vi.clearAllMocks()
  })

  it("forwards imageUrl and externalUrl to submit unchanged when valid", async () => {
    const { POST } = await import("@/app/api/events/create-simple/route")

    const reviewShaped = {
      creatorEmail: "creator@example.com",
      title: "Quiz night",
      description: "Weekly trivia",
      start: "2026-07-01T18:00:00.000Z",
      end: "2026-07-01T21:00:00.000Z",
      timezone: "Australia/Melbourne",
      location: { name: "Pub", city: "Melbourne", country: "Australia" },
      category: "COMEDY",
      imageUrl: "https://images.example.com/poster.jpg",
      externalUrl: "https://tickets.example.com/quiz",
      tags: [],
      source_text: "Quiz at the pub",
    }

    const res = await POST(
      new Request("http://localhost/api/events/create-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewShaped),
      }),
    )

    expect(res.ok).toBe(true)
    const out = await res.json()
    expect(out.success).toBe(true)
    expect(out.eventId).toBe("evt_contract_test")

    expect(lastSubmitBody).not.toBeNull()
    expect(lastSubmitBody!.imageUrl).toBe("https://images.example.com/poster.jpg")
    expect(lastSubmitBody!.externalUrl).toBe("https://tickets.example.com/quiz")
    expect(lastSubmitBody!.creatorEmail).toBe("creator@example.com")
    expect(lastSubmitBody!.category).toBe("COMEDY")
  })

  it("omits empty imageUrl from forwarded body when trimmed empty", async () => {
    const { POST } = await import("@/app/api/events/create-simple/route")

    const reviewShaped = {
      creatorEmail: "creator@example.com",
      title: "A",
      description: "B",
      start: "2026-07-01T18:00:00.000Z",
      category: "MUSIC",
      imageUrl: "   ",
      externalUrl: "https://example.com",
    }

    const res = await POST(
      new Request("http://localhost/api/events/create-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewShaped),
      }),
    )

    expect(res.ok).toBe(true)
    expect(lastSubmitBody!.imageUrl).toBeUndefined()
    expect(lastSubmitBody!.externalUrl).toBe("https://example.com")
  })
})
