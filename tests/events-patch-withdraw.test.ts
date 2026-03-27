import { describe, it, expect, vi, beforeEach } from "vitest"

const findUnique = vi.fn()
const update = vi.fn()

vi.mock("@/lib/db", () => ({
  default: {
    event: { findUnique, update },
  },
}))

vi.mock("@/lib/eventEditToken", () => ({
  validateEventEditToken: vi.fn(async () => true),
}))

vi.mock("@/lib/search/language-detection-enhanced", () => ({ detectEventLanguage: vi.fn() }))
vi.mock("@/lib/embeddings/generate", () => ({ generateEventEmbedding: vi.fn(), shouldSkipEmbedding: () => true }))
vi.mock("@/lib/embeddings/store", () => ({ storeEventEmbedding: vi.fn() }))

describe("PATCH /api/events/[id] withdraw", () => {
  beforeEach(() => {
    findUnique.mockReset()
    update.mockReset()
  })

  it("sets ARCHIVED when withdraw is true", async () => {
    findUnique.mockResolvedValueOnce({ id: "evt-1", status: "PUBLISHED" })
    update.mockResolvedValueOnce({ id: "evt-1", status: "ARCHIVED" })

    const { PATCH } = await import("@/app/api/events/[id]/route")
    const res = await PATCH(
      new Request("http://localhost/api/events/evt-1?token=tok", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdraw: true }),
      }),
      { params: Promise.resolve({ id: "evt-1" }) },
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { withdrawn?: boolean }
    expect(body.withdrawn).toBe(true)
    expect(update).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: { status: "ARCHIVED" },
    })
  })

  it("is idempotent when already ARCHIVED", async () => {
    findUnique.mockResolvedValueOnce({ id: "evt-1", status: "ARCHIVED" })

    const { PATCH } = await import("@/app/api/events/[id]/route")
    const res = await PATCH(
      new Request("http://localhost/api/events/evt-1?token=tok", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdraw: true }),
      }),
      { params: Promise.resolve({ id: "evt-1" }) },
    )

    expect(res.status).toBe(200)
    expect(update).not.toHaveBeenCalled()
  })
})
