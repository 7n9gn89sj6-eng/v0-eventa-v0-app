import { describe, it, expect } from "vitest"
import { extractWantsPastOrHistory, parseSearchIntent } from "@/app/lib/search/parseSearchIntent"

describe("wantsPastOrHistory / extractWantsPastOrHistory", () => {
  it("is false for normal discovery queries", () => {
    expect(extractWantsPastOrHistory("music festivals melbourne")).toBe(false)
    expect(parseSearchIntent("jazz gigs this weekend").wantsPastOrHistory).toBeUndefined()
  })

  it("is true for archive / past-event phrasing", () => {
    expect(extractWantsPastOrHistory("historical archive comedy shows")).toBe(true)
    expect(extractWantsPastOrHistory("past events in Sydney")).toBe(true)
    expect(extractWantsPastOrHistory("old events Berlin")).toBe(true)
    expect(parseSearchIntent("historical archive comedy shows").wantsPastOrHistory).toBe(true)
  })

  it("does not treat bare 'history' as past intent", () => {
    expect(extractWantsPastOrHistory("black history month events")).toBe(false)
  })
})
