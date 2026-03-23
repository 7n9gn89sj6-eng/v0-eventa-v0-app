import { describe, expect, it } from "vitest"
import { applyBroadWebHostDiversity } from "@/lib/search/broad-web-host-diversity"

const future = "2026-06-01T12:00:00.000Z"

function web(id: string, host: string, score: number) {
  return {
    id,
    _resultKind: "web" as const,
    _score: score,
    url: `https://${host}/e/${id}`,
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
  it("spaces repeated same-host web results when another host scores between them (K=3)", () => {
    // Second EB at preIdx 2: penalty 3 → eff 97; timeout at 98 between 100 and 97.
    const rows = [
      internal("lead", 300),
      web("a", "eventbrite.com", 100),
      web("b", "eventbrite.com", 100),
      web("c", "timeout.com", 98),
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

  it("does not reorder internal-only results", () => {
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

  it("softens penalty for top two overall slots (strong same-host pair near top)", () => {
    const rows = [
      web("a", "eventbrite.com", 100),
      web("b", "eventbrite.com", 100),
      web("c", "timeout.com", 97),
    ]
    const out = applyBroadWebHostDiversity(rows)
    // b at preIdx 1: raw penalty 3 → floor(3 * 0.25) = 0 → eff 100; still above c at 97
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"])
  })

  it("first occurrence of a host keeps full score (single strong same-host result)", () => {
    const rows = [
      web("solo", "eventbrite.com", 100),
      web("other", "timeout.com", 50),
    ]
    const out = applyBroadWebHostDiversity(rows)
    expect(out.map((r) => r.id)).toEqual(["solo", "other"])
    expect((out[0] as any)._diversityPenalty).toBe(0)
  })

  it("uses url field with new URL().hostname (invalid URL skipped safely)", () => {
    const rows = [
      { id: "bad", _resultKind: "web" as const, _score: 50, url: "http://[", startAt: future },
      web("good", "example.com", 40),
    ]
    const out = applyBroadWebHostDiversity(rows)
    expect(out).toHaveLength(2)
    expect((out[0] as any)._diversityHost).toBe("(unknown)")
  })
})
