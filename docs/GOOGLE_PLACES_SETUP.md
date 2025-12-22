# Google Places Autocomplete Setup Guide

## Issue: "This page can't load Google Maps correctly" or "Legacy API not enabled"

If you see these errors, it means the Places API needs to be enabled in Google Cloud Console.

## Steps to Fix:

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Select Your Project
Make sure you're in the correct project (the one with your API key).

### 3. Enable Places API (Legacy)
1. Go to: https://console.cloud.google.com/apis/library/places-backend.googleapis.com
2. Click the **"Enable"** button
3. Wait for it to enable (usually takes a few seconds)

### 4. Verify API Key Has Access
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your API key (the one starting with `AIzaSy...`)
3. Click on it to edit
4. Under "API restrictions":
   - Select "Restrict key"
   - Make sure "Places API" (Legacy) is checked/enabled
   - OR select "Don't restrict key" (for development/testing only)

### 5. Wait and Refresh
- Wait 1-2 minutes for changes to propagate
- Refresh your browser page
- Try typing in the address field again

## Alternative: Use Places API (New)

Google is encouraging migration to Places API (New), which requires:
- Different API endpoint
- Different authentication method (requires server-side proxy)
- More complex setup

For now, enabling Places API (Legacy) is the quickest solution.

## Verify It's Working

After enabling the API:
1. Check browser console - should see:
   - `✓ Google Places API loaded successfully`
   - `✓ Autocomplete initialized successfully`
2. Type in address field - dropdown should appear
3. No more error messages about legacy API

## Troubleshooting

**Still not working?**
1. Make sure API key is correct in `.env.local`
2. Make sure you restarted the dev server after adding the key
3. Check that Places API (Legacy) is enabled (step 3 above)
4. Check API key restrictions (step 4 above)
5. Try clearing browser cache and refreshing

