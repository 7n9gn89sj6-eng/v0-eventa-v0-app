/**
 * Seed events from JSON via prisma.event.createMany.
 *
 * Usage: npx tsx scripts/seed-events.ts
 *
 * Reads: scripts/seed-events.json — must be a JSON array of event objects.
 * Required per row: title, description, startAt, endAt, city, country, createdById
 * Optional: searchText, searchTextFolded (derived if omitted), categories, status, etc.
 * Dates: ISO 8601 strings (e.g. "2026-07-01T10:00:00.000Z").
 *
 * Idempotent: skips any row whose title already exists (exact match).
 * Optional env: SEED_CREATED_BY_USER_ID — overrides createdById for every row (must exist in User).
 */

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { config } from "dotenv"
import { createSearchTextFolded } from "../lib/search/accent-fold"
import type { Prisma } from "@prisma/client"

const JSON_PATH = path.join(process.cwd(), "scripts", "seed-events.json")

function parseDate(value: unknown, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "string") {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  throw new Error(`Invalid date for ${field}: ${String(value)}`)
}

function buildSearchText(row: Record<string, unknown>): string {
  const title = String(row.title ?? "")
  const description = String(row.description ?? "")
  const city = String(row.city ?? "")
  const country = String(row.country ?? "")
  return `${title} ${description} ${city} ${country}`.trim().toLowerCase()
}

function toCreateInput(raw: Record<string, unknown>): Prisma.EventCreateManyInput {
  const title = String(raw.title ?? "")
  const description = String(raw.description ?? "")
  const city = String(raw.city ?? "")
  const country = String(raw.country ?? "")
  const createdById = String(raw.createdById ?? "")
  if (!title || !description || !city || !country || !createdById) {
    throw new Error(
      "Each event needs title, description, city, country, createdById",
    )
  }

  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((c) => String(c))
    : []

  const searchText =
    typeof raw.searchText === "string" && raw.searchText.length > 0
      ? raw.searchText
      : buildSearchText({ title, description, city, country })

  const searchTextFolded =
    typeof raw.searchTextFolded === "string" && raw.searchTextFolded.length > 0
      ? raw.searchTextFolded
      : createSearchTextFolded([title, description, city, country, ...categories])

  const base: Prisma.EventCreateManyInput = {
    title,
    description,
    startAt: parseDate(raw.startAt, "startAt"),
    endAt: parseDate(raw.endAt, "endAt"),
    city,
    country,
    createdById,
    searchText,
    searchTextFolded,
    categories,
  }

  const optionalKeys = [
    "locationAddress",
    "imageUrl",
    "externalUrl",
    "timezone",
    "venueName",
    "address",
    "lat",
    "lng",
    "region",
    "parentCity",
    "formattedAddress",
    "placeProvider",
    "externalPlaceId",
    "priceFree",
    "priceAmount",
    "websiteUrl",
    "languages",
    "language",
    "imageUrls",
    "postcode",
    "status",
    "category",
    "moderationStatus",
    "tags",
    "organizerName",
    "organizerContact",
    "publishedAt",
  ] as const

  for (const key of optionalKeys) {
    if (raw[key] === undefined || raw[key] === null) continue
    if (key === "publishedAt") {
      ;(base as Record<string, unknown>)[key] = parseDate(raw[key], "publishedAt")
      continue
    }
    ;(base as Record<string, unknown>)[key] = raw[key]
  }

  if ((base as Record<string, unknown>).category === undefined) {
    ;(base as Record<string, unknown>).category = "OTHER"
    ;(base as Record<string, unknown>).customCategoryLabel = "Seed (category omitted)"
  }

  return base
}

async function main() {
  config({ path: path.resolve(process.cwd(), ".env.local") })
  config({ path: path.resolve(process.cwd(), ".env") })

  if (!existsSync(JSON_PATH)) {
    console.error(`Missing ${JSON_PATH}`)
    process.exit(1)
  }

  const raw = JSON.parse(readFileSync(JSON_PATH, "utf8"))
  if (!Array.isArray(raw)) {
    console.error("seed-events.json must be a JSON array")
    process.exit(1)
  }

  let data: Prisma.EventCreateManyInput[] = raw.map((row, i) => {
    if (row === null || typeof row !== "object") {
      throw new Error(`Invalid row at index ${i}`)
    }
    return toCreateInput(row as Record<string, unknown>)
  })

  const overrideUserId = process.env.SEED_CREATED_BY_USER_ID?.trim()
  if (overrideUserId) {
    data = data.map((row) => ({ ...row, createdById: overrideUserId }))
  }

  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()

  try {
    const userIds = [...new Set(data.map((d) => d.createdById))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    })
    if (users.length !== userIds.length) {
      const found = new Set(users.map((u) => u.id))
      const missing = userIds.filter((id) => !found.has(id))
      console.error("Unknown createdById(s):", missing.join(", "))
      process.exit(1)
    }

    const titles = data.map((d) => d.title)
    const existing = await prisma.event.findMany({
      where: { title: { in: titles } },
      select: { title: true },
    })
    const existingTitles = new Set(existing.map((e) => e.title))
    const toInsert = data.filter((d) => !existingTitles.has(d.title))

    if (toInsert.length === 0) {
      console.log(
        `Inserted 0 event(s). All ${data.length} row(s) already exist (matched by title).`,
      )
      return
    }

    const { count } = await prisma.event.createMany({ data: toInsert })
    const skipped = data.length - count
    console.log(
      `Inserted ${count} event(s).${skipped > 0 ? ` Skipped ${skipped} existing (same title).` : ""}`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
