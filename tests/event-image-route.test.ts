import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

const sendMock = vi.fn()

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock
  },
  PutObjectCommand: class {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  getClientIdentifier: vi.fn(() => "127.0.0.1"),
  rateLimiters: { api: {} },
}))

describe("POST /api/events/event-image", () => {
  const prevEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    sendMock.mockResolvedValue({})
    process.env.R2_ACCOUNT_ID = "testaccount"
    process.env.R2_ACCESS_KEY_ID = "key"
    process.env.R2_SECRET_ACCESS_KEY = "secret"
    process.env.R2_BUCKET_NAME = "bucket"
    process.env.R2_PUBLIC_BASE_URL = "https://pub.example.test"
  })

  afterEach(() => {
    process.env = { ...prevEnv }
  })

  it("returns 503 when R2 env is missing", async () => {
    delete process.env.R2_ACCOUNT_ID
    const { POST } = await import("@/app/api/events/event-image/route")
    const res = await POST(new Request("http://localhost/api/events/event-image", { method: "POST" }))
    expect(res.status).toBe(503)
  })

  it("uploads and returns url", async () => {
    const { POST } = await import("@/app/api/events/event-image/route")
    const buf = new Uint8Array(50)
    const file = new File([buf], "p.jpg", { type: "image/jpeg" })
    const fd = new FormData()
    fd.append("file", file)

    const res = await POST(
      new Request("http://localhost/api/events/event-image", { method: "POST", body: fd }),
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toMatch(/^https:\/\/pub\.example\.test\/events\/[a-f0-9-]+\.jpg$/)
    expect(sendMock).toHaveBeenCalledTimes(1)
  })
})
