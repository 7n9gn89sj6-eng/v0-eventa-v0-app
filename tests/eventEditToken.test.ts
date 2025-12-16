import { describe, it, expect, beforeEach, vi } from "vitest"
import { createEventEditToken, validateEventEditToken } from "@/lib/eventEditToken"
import db from "@/lib/db"
import bcrypt from "bcryptjs"

// Mock dependencies
vi.mock("@/lib/db", () => ({
  default: {
    eventEditToken: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

describe("createEventEditToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should create a token and store it in the database", async () => {
    const mockToken = "test-token-uuid"
    const mockHash = "hashed-token"
    const eventId = "event-123"

    // Mock bcrypt.hash to return a hash
    vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never)

    // Mock db.eventEditToken.create
    vi.mocked(db.eventEditToken.create).mockResolvedValue({
      id: "token-id",
      eventId,
      tokenHash: mockHash,
      expires: new Date(),
      createdAt: new Date(),
    } as never)

    // Mock crypto.randomUUID
    const originalRandomUUID = global.crypto?.randomUUID
    if (global.crypto) {
      global.crypto.randomUUID = vi.fn(() => mockToken)
    }

    const token = await createEventEditToken(eventId)

    expect(token).toBe(mockToken)
    expect(bcrypt.hash).toHaveBeenCalledWith(mockToken, 12)
    expect(db.eventEditToken.create).toHaveBeenCalledWith({
      data: {
        eventId,
        tokenHash: mockHash,
        expires: expect.any(Date),
      },
    })

    // Restore original
    if (originalRandomUUID && global.crypto) {
      global.crypto.randomUUID = originalRandomUUID
    }
  })

  it("should calculate expiry date correctly", async () => {
    const mockToken = "test-token"
    const mockHash = "hashed-token"
    const eventId = "event-123"
    const now = Date.now()

    vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never)
    vi.mocked(db.eventEditToken.create).mockResolvedValue({
      id: "token-id",
      eventId,
      tokenHash: mockHash,
      expires: new Date(),
      createdAt: new Date(),
    } as never)

    if (global.crypto) {
      global.crypto.randomUUID = vi.fn(() => mockToken)
    }

    await createEventEditToken(eventId)

    const createCall = vi.mocked(db.eventEditToken.create).mock.calls[0]
    const expiresDate = createCall[0].data.expires as Date
    const expectedExpiry = now + 30 * 24 * 60 * 60 * 1000

    // Allow 1 second tolerance for test execution time
    expect(expiresDate.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000)
    expect(expiresDate.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000)
  })
})

describe("validateEventEditToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return false for empty token", async () => {
    const result = await validateEventEditToken("event-123", "")
    expect(result).toBe(false)
    expect(db.eventEditToken.findMany).not.toHaveBeenCalled()
  })

  it("should return false when no tokens found", async () => {
    vi.mocked(db.eventEditToken.findMany).mockResolvedValue([])

    const result = await validateEventEditToken("event-123", "some-token")
    expect(result).toBe(false)
  })

  it("should return false for expired token", async () => {
    const expiredDate = new Date(Date.now() - 1000) // 1 second ago
    vi.mocked(db.eventEditToken.findMany).mockResolvedValue([
      {
        tokenHash: "hash",
        expires: expiredDate,
      },
    ] as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await validateEventEditToken("event-123", "some-token")
    expect(result).toBe(false)
  })

  it("should return false for invalid token hash", async () => {
    const futureDate = new Date(Date.now() + 1000000)
    vi.mocked(db.eventEditToken.findMany).mockResolvedValue([
      {
        tokenHash: "hash",
        expires: futureDate,
      },
    ] as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    const result = await validateEventEditToken("event-123", "some-token")
    expect(result).toBe(false)
  })

  it("should return true for valid non-expired token", async () => {
    const futureDate = new Date(Date.now() + 1000000)
    vi.mocked(db.eventEditToken.findMany).mockResolvedValue([
      {
        tokenHash: "hash",
        expires: futureDate,
      },
    ] as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const result = await validateEventEditToken("event-123", "some-token")
    expect(result).toBe(true)
  })

  it("should check multiple tokens and return true if any match", async () => {
    const futureDate = new Date(Date.now() + 1000000)
    vi.mocked(db.eventEditToken.findMany).mockResolvedValue([
      {
        tokenHash: "hash1",
        expires: futureDate,
      },
      {
        tokenHash: "hash2",
        expires: futureDate,
      },
    ] as never)
    vi.mocked(bcrypt.compare)
      .mockResolvedValueOnce(false as never)
      .mockResolvedValueOnce(true as never)

    const result = await validateEventEditToken("event-123", "some-token")
    expect(result).toBe(true)
    expect(bcrypt.compare).toHaveBeenCalledTimes(2)
  })
})

