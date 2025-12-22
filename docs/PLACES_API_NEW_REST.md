# Places API (New) REST Implementation

## Current Implementation

The component now uses the **Places API (New) REST endpoints** directly via `fetch`, which:
- ✅ Works with "Places API (New)" enabled in Google Cloud Console
- ✅ Avoids deprecated JavaScript SDK classes (`AutocompleteService`, `PlacesService`)
- ✅ Uses modern REST API with proper authentication headers
- ✅ Supports session tokens for billing optimization

## Endpoints Used

1. **Autocomplete**: `POST https://places.googleapis.com/v1/places:autocomplete`
2. **Place Details**: `GET https://places.googleapis.com/v1/places/{placeId}`

## Authentication

Uses the `X-Goog-Api-Key` header with your API key from `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

## Required Setup

1. **Enable Places API (New)** in Google Cloud Console:
   - Go to: https://console.cloud.google.com/
   - Select your project
   - Navigate to: **APIs & Services** → **Library**
   - Search for: **"Places API (New)"**
   - Click **"Enable"**

2. **Verify API Key Permissions**:
   - Go to: **APIs & Services** → **Credentials**
   - Click on your API key
   - Ensure **"Places API (New)"** is enabled (or key is unrestricted)

3. **Content Security Policy**:
   - The CSP in `next.config.mjs` includes `https://places.googleapis.com` in `connect-src`
   - This allows the REST API calls to work

## Features

- **Debounced input**: 300ms delay to reduce API calls
- **Session tokens**: Generated per search session for billing optimization
- **Keyboard navigation**: Arrow keys, Enter, Escape
- **Click outside to close**: Suggestions close when clicking elsewhere
- **Custom dropdown**: Fully styled dropdown with hover states

## Testing

1. Go to "Post Event" page
2. Click in the address field
3. Type at least 2 characters
4. Suggestions should appear in a dropdown
5. Click a suggestion or press Enter to select
6. Address, city, country, and coordinates should auto-fill

## Troubleshooting

### No suggestions appear
- Check browser console for errors
- Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set correctly
- Ensure "Places API (New)" is enabled (not "Places API" legacy)
- Check network tab for failed requests to `places.googleapis.com`

### CORS errors
- Make sure CSP includes `https://places.googleapis.com` in `connect-src`
- Restart dev server after changing `next.config.mjs`

### 403 Forbidden errors
- Verify API key has access to "Places API (New)"
- Check API key restrictions allow the Places API

