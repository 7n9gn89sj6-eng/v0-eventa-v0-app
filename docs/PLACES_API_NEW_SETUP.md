# Places API (New) Setup Guide

## Current Implementation

The application now uses **Places API (New)** via:
- `AutocompleteService` for fetching autocomplete predictions
- `PlacesService` for getting place details
- `AutocompleteSessionToken` for billing optimization (optional)

## Enable Places API (New) in Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Select the project that contains your API key: `AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg`
3. Navigate to: **APIs & Services** → **Library**
4. Search for: **"Places API (New)"**
5. Click on **"Places API (New)"** (not "Places API" legacy)
6. Click **"Enable"**
7. Wait 1-2 minutes for changes to propagate

## Verify API Key Permissions

1. Go to: **APIs & Services** → **Credentials**
2. Click on your API key: `AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg`
3. Under **"API restrictions"**:
   - Either: Select **"Don't restrict key"** (easiest for testing)
   - Or: Select **"Restrict key"** and ensure **"Places API (New)"** is checked

## Test the Implementation

1. Go to your "Post Event" page
2. Click in the address field
3. Start typing an address (e.g., "35 High")
4. You should see autocomplete suggestions appear
5. Click on a suggestion to auto-fill the address

## Troubleshooting

### Error: "REQUEST_DENIED"
- **Cause:** Places API (New) is not enabled
- **Fix:** Enable "Places API (New)" in Google Cloud Console (see steps above)

### No suggestions appear
- Check browser console for errors
- Verify API key is correct in `.env.local`
- Ensure "Places API (New)" is enabled (not just "Places API" legacy)
- Wait a few minutes after enabling the API

### Suggestions appear but selecting doesn't work
- Check browser console for errors
- Verify that `PlacesService` is initialized correctly
- Check that the place details request is successful

## Billing Notes

- Using `AutocompleteSessionToken` helps optimize billing:
  - One session token per user search session
  - Autocomplete requests and place details share the same token
  - Google counts them as a single request for billing purposes
- Without session tokens, each autocomplete suggestion click counts as a separate request

## API Differences

**Old (Legacy) API:**
- Used `google.maps.places.Autocomplete` class
- Required "Places API" (Legacy) to be enabled
- Deprecated for new projects as of March 1, 2025

**New API (Current):**
- Uses `AutocompleteService` and `PlacesService`
- Requires "Places API (New)" to be enabled
- Recommended approach for new projects
- Better billing optimization with session tokens
- More flexible and feature-rich

