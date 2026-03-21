/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react"
import React from "react"
import { MapboxPlaceAutocomplete } from "@/components/places/mapbox-place-autocomplete"

describe("MapboxPlaceAutocomplete", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/api/places/suggest")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                suggestions: [
                  { id: "place.abc", label: "Melbourne, Victoria, Australia", primary: "Melbourne" },
                ],
              }),
          })
        }
        if (url.includes("/api/places/resolve")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                place: {
                  provider: "mapbox",
                  placeId: "place.abc",
                  formattedAddress: "Melbourne, Victoria, Australia",
                  city: "Melbourne",
                  country: "Australia",
                  region: "Victoria",
                  parentCity: null,
                  lat: -37.81,
                  lng: 144.96,
                  venueName: "Melbourne",
                },
              }),
          })
        }
        return Promise.reject(new Error("unexpected fetch"))
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("selects a suggestion and emits onResolved with canonical place", async () => {
    const onResolved = vi.fn()
    const onClear = vi.fn()

    render(
      <MapboxPlaceAutocomplete onResolved={onResolved} onClear={onClear} testId="place-ac" />,
    )

    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "Mel" } })

    await waitFor(() => {
      expect(screen.getByText("Melbourne, Victoria, Australia")).toBeTruthy()
    })

    fireEvent.click(screen.getByText("Melbourne, Victoria, Australia"))

    await waitFor(() => {
      expect(onResolved).toHaveBeenCalledTimes(1)
    })

    const place = onResolved.mock.calls[0][0]
    expect(place.city).toBe("Melbourne")
    expect(place.country).toBe("Australia")
    expect(place.placeId).toBe("place.abc")
    expect(place.lat).toBe(-37.81)
  })
})
