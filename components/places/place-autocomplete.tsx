/**
 * Shared verify-then-select place entry (Mapbox-backed via server APIs).
 * Re-export for a stable import path across Post Event, Header, and Discover.
 */
export {
  MapboxPlaceAutocomplete as PlaceAutocomplete,
  type MapboxPlaceAutocompleteProps as PlaceAutocompleteProps,
} from "@/components/places/mapbox-place-autocomplete"
