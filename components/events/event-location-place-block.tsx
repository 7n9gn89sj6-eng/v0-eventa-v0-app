"use client"

import { PlaceAutocomplete } from "@/components/places/place-autocomplete"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SelectedPlaceWire } from "@/lib/places/selected-place"

export type EventLocationPlaceBlockProps = {
  disabled?: boolean
  /** Prefix for element ids, e.g. `event` → `event-location-search`. */
  idPrefix?: string
  testId?: string
  initialQuery?: string
  label?: string
  description?: string
  selectedPlace: SelectedPlaceWire | null
  onSelectedPlaceChange: (place: SelectedPlaceWire | null) => void
  venueName: string
  onVenueNameChange: (value: string) => void
  addressLine: string
  onAddressLineChange: (value: string) => void
}

/**
 * Shared Mapbox verify-then-select location UI for Post Event and AI review-draft.
 * City / state / postcode / country come from the verified {@link SelectedPlaceWire} on submit, not separate fields.
 */
export function EventLocationPlaceBlock({
  disabled = false,
  idPrefix = "event-location",
  testId,
  initialQuery,
  label = "Find address on map",
  description,
  selectedPlace,
  onSelectedPlaceChange,
  venueName,
  onVenueNameChange,
  addressLine,
  onAddressLineChange,
}: EventLocationPlaceBlockProps) {
  const searchId = `${idPrefix}-search`
  const venueId = `${idPrefix}-venue-name`
  const addressId = `${idPrefix}-address`

  return (
    <div className="space-y-4">
      <PlaceAutocomplete
        disabled={disabled}
        id={searchId}
        testId={testId}
        allowEditQueryWhileSelected
        initialQuery={initialQuery}
        label={label}
        description={description}
        onResolved={(place) => {
          onSelectedPlaceChange(place)
          onVenueNameChange(place.venueName?.trim() || "")
          onAddressLineChange(place.formattedAddress ?? "")
        }}
        onClear={() => {
          onSelectedPlaceChange(null)
          onVenueNameChange("")
          onAddressLineChange("")
        }}
      />

      {!selectedPlace?.placeId ? (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
            Choose a location from the suggestions and confirm your selection before publishing.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={venueId}>Venue name</Label>
        <Input
          id={venueId}
          placeholder="Shown on the event page"
          disabled={disabled}
          value={venueName}
          onChange={(e) => onVenueNameChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          You can edit how the venue appears after selecting a place.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={addressId}>Address (full line)</Label>
        <Input
          id={addressId}
          placeholder="Filled when you pick a location from the list"
          disabled={disabled}
          value={addressLine}
          onChange={(e) => onAddressLineChange(e.target.value)}
        />
      </div>
    </div>
  )
}
