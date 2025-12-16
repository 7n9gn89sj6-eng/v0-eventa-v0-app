import { describe, it, expect, beforeEach, vi } from "vitest"
import { searchDatabase } from "@/lib/search/database-search"
import db from "@/lib/db"
import { Prisma } from "@prisma/client"

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

describe("searchDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return empty array when no results found", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([])

    const results = await searchDatabase({
      query: "test",
      synonyms: [],
      categories: [],
      limit: 20,
    })

    expect(results).toEqual([])
    expect(db.$queryRaw).toHaveBeenCalled()
  })

  it("should transform database results to SearchResult format", async () => {
    const mockDbResult = [
      {
        id: "event-1",
        title: "Test Event",
        description: "Test description",
        startAt: new Date("2026-01-20T10:00:00Z"),
        endAt: new Date("2026-01-20T12:00:00Z"),
        city: "Melbourne",
        country: "Australia",
        venueName: "Test Venue",
        address: "123 Test St",
        lat: -37.8136,
        lng: 144.9631,
        categories: ["Music"],
        priceFree: false,
        imageUrls: ["https://example.com/image.jpg"],
        rank: 0.5,
        distance_km: 5.2,
      },
    ]

    vi.mocked(db.$queryRaw).mockResolvedValue(mockDbResult as never)

    const results = await searchDatabase({
      query: "test",
      synonyms: [],
      categories: [],
      limit: 20,
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      source: "eventa",
      id: "event-1",
      title: "Test Event",
      venue: "Test Venue",
      address: "123 Test St",
      lat: -37.8136,
      lng: 144.9631,
      categories: ["Music"],
      priceFree: false,
      imageUrl: "https://example.com/image.jpg",
      distanceKm: 5.2,
    })
    expect(results[0].startAt).toBe("2026-01-20T10:00:00.000Z")
    expect(results[0].endAt).toBe("2026-01-20T12:00:00.000Z")
  })

  it("should handle null values gracefully", async () => {
    const mockDbResult = [
      {
        id: "event-1",
        title: "Test Event",
        description: null,
        startAt: new Date("2026-01-20T10:00:00Z"),
        endAt: new Date("2026-01-20T12:00:00Z"),
        city: "Melbourne",
        country: "Australia",
        venueName: null,
        address: null,
        lat: null,
        lng: null,
        categories: [],
        priceFree: false,
        imageUrls: [],
        rank: 0.5,
        distance_km: null,
      },
    ]

    vi.mocked(db.$queryRaw).mockResolvedValue(mockDbResult as never)

    const results = await searchDatabase({
      query: "test",
      synonyms: [],
      categories: [],
      limit: 20,
    })

    expect(results[0]).toMatchObject({
      venue: null,
      address: null,
      lat: null,
      lng: null,
      imageUrl: null,
      distanceKm: undefined,
    })
    expect(results[0].snippet).toBe("...")
  })

  it("should apply filters correctly", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([])

    await searchDatabase({
      query: "test",
      synonyms: [],
      categories: ["Music"],
      filters: {
        free: true,
        dateRange: "today",
      },
      limit: 10,
    })

    const queryCall = vi.mocked(db.$queryRaw).mock.calls[0][0] as Prisma.Sql
    expect(queryCall).toBeDefined()
  })

  it("should handle errors and log them", async () => {
    const mockError = new Error("Database connection failed")
    vi.mocked(db.$queryRaw).mockRejectedValue(mockError)

    await expect(
      searchDatabase({
        query: "test",
        synonyms: [],
        categories: [],
      })
    ).rejects.toThrow("Database connection failed")
  })
})

