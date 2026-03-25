import { describe, it, expect } from "vitest"
import {
  applyNamedEventSameHostWebDedupe,
  normalizeHostnameForDedupe,
  tryParseUrlHostname,
} from "@/lib/search/named-event-same-host-dedupe"

describe("named-event same-host dedupe", () => {
  it("normalizes www and case for host comparison", () => {
    expect(normalizeHostnameForDedupe("WWW.Example.COM")).toBe("example.com")
    expect(tryParseUrlHostname("https://WWW.Comedyfestival.Com.Au/shows")).toBe("comedyfestival.com.au")
  })

  it("suppresses web rows when internal lists the same official host", () => {
    const future = "2026-06-01T12:00:00.000Z"
    const unified = [
      {
        id: "micf-internal",
        title: "Melbourne International Comedy Festival",
        startAt: future,
        externalUrl: "https://www.comedyfestival.com.au/",
        _score: 100,
        _resultKind: "internal" as const,
      },
      {
        title: "MICF browse",
        startAt: future,
        externalUrl: "https://comedyfestival.com.au/browse-shows",
        _originalUrl: "https://comedyfestival.com.au/browse-shows",
        _score: 90,
        _resultKind: "web" as const,
      },
      {
        title: "MICF home",
        startAt: future,
        url: "https://comedyfestival.com.au/",
        _score: 85,
        _resultKind: "web" as const,
      },
      {
        title: "Third party listing",
        startAt: future,
        externalUrl: "https://other.example.com/micf",
        _score: 80,
        _resultKind: "web" as const,
      },
    ]

    const out = applyNamedEventSameHostWebDedupe(unified)
    expect(out.map((r) => r._resultKind)).toEqual(["internal", "web"])
    expect((out[1] as { externalUrl?: string }).externalUrl).toContain("other.example.com")
  })

  it("is a no-op when no internal externalUrl host is present", () => {
    const rows = [
      { _resultKind: "internal" as const, externalUrl: null, id: "a" },
      {
        _resultKind: "web" as const,
        externalUrl: "https://x.com/",
        _score: 1,
      },
    ]
    expect(applyNamedEventSameHostWebDedupe(rows as any[])).toEqual(rows)
  })
})
