import prisma from "@/lib/db"
import { PUBLIC_EVENT_WHERE } from "@/lib/events"

/**
 * Infer parent metro from published events that share the same locality label and a stored `parentCity`.
 * Used for ambient UI suburb broadening before the minimal hardcoded fallback map.
 */
export async function fetchParentMetroFromStoredEvents(executionCity: string): Promise<string | null> {
  const key = executionCity.trim()
  if (key.length < 2) return null

  try {
    const row = await prisma.event.findFirst({
      where: {
        ...PUBLIC_EVENT_WHERE,
        city: { contains: key, mode: "insensitive" },
        parentCity: { not: null },
      },
      select: { parentCity: true },
      orderBy: { updatedAt: "desc" },
    })
    const p = row?.parentCity?.trim()
    return p && p.length > 0 ? p : null
  } catch {
    return null
  }
}
