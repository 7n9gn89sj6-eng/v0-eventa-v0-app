import { describe, expect, it } from "vitest"
import { applyBroadWebHostDiversity } from "@/lib/search/broad-web-host-diversity"

const future = "2026-06-01T12:00:00.000Z"

function web(id: string, host: string, score: number) {
  return {
    id,
    _resultKind: "web" as const,
    _score: score,
    externalUrl: `https://${host}/e/${id}`,
    startAt: future,
  }
}

function internal(id: string, score: number) {
  return {
    id,
    _resultKind: "internal" as const,
    _score: score,
    startAt: future,
  }
}

describe("applyBroadWebHostDiversity", () => {
  it("spaces repeated same-host web results when another host scores between them (linear penalty)", () => {
    // K=4: second EB at preIdx 2 → penalty 4 → eff 96; timeout at 97 stays between 100 and 96.
    const rows = [
      internal("lead", 300),
      web("a", "eventbrite.com", 100),
      web("b", "eventbrite.com", 100),
      web("c", "timeout.com", 97),
    ]
    const out = applyBroadWebHostDiversity(rows)
    expect(out.map((r) => r.id)).toEqual(["lead", "a", "c", "b"])
  })

  it("keeps internal results ahead of web when internal scores are higher", () => {
    const rows = [
      internal("int", 200),
      web("a", "eventbrite.com", 100),
      web("b", "eventbrite.com", 100),
      web("c", "timeout.com", 99),
    ]
    const out = applyBroadWebHostDiversity(rows)
    expect(out[0].id).toBe("int")
    expect(out.map((r) => r.id)).toEqual(["int", "a", "c", "b"])
  })

  it("does not reorder internal-only results (stable effective scores)", () => {
    const rows = [internal("i1", 80), internal("i2", 90), internal("i3", 85)]
    const out = applyBroadWebHostDiversity(rows)
    expect(out.map((r) => r.id)).toEqual(["i2", "i3", "i1"])
  })

  it("leaves single-row and empty lists unchanged", () => {
    expect(applyBroadWebHostDiversity([])).toEqual([])
    const one = [web("x", "x.com", 10)]
    const out = applyBroadWebHostDiversity(one)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("x")
    expect((out[0] as any)._hostOccurrenceIndex).toBe(0)
    expect((out[0] as any)._diversityPenalty).toBe(0)
  })

  it("softens penalty in top two overall slots so a strong same-host pair is not over-penalized", () => {
    const rows = [
      web("a", "eventbrite.com", 100),
      web("b", "eventbrite.com", 100),
      web("c", "timeout.com", 97),
    ]
    const out = applyBroadWebHostDiversity(rows)
    // b at preIdx 1: occurrence 1 → raw 4, softened floor(4 * 0.25) = 1 → eff 99, still above 97
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"])
  })

  it("first occurrence of a host stays at full score (single dominant same-host result)", () => {
    const rows = [
      web("solo", "eventbrite.com", 100),
      web("other", "timeout.com", 50),
    ]
    const out = applyBroadWebHostDiversity(rows)
    expect(out.map((r) => r.id)).toEqual(["solo", "other"])
    expect((out[0] as any)._diversityPenalty).toBe(0)
  })
})
