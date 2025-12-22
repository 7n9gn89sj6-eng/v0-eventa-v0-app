# Google API Key Verification Guide

## Problem: API Key from Different Google Account

If you created API keys using a different Google account, you need to verify:

1. **Which Google Cloud project the API key belongs to**
2. **Enable the Places API in that specific project**

## Step 1: Identify Your API Key

Your API key starts with: `AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg`

## Step 2: Verify Which Project It Belongs To

### Method A: Test the API Key (Quick)

1. Open this URL in your browser (replace `YOUR_API_KEY` with your actual key):
   ```
   https://maps.googleapis.com/maps/api/place/autocomplete/json?input=test&key=YOUR_API_KEY
   ```

2. Look at the response:
   - If you see an error mentioning a project ID or project name → That's your project
   - If you see "API not enabled" → You're in the right project but API isn't enabled
   - If you see "API key invalid" → Wrong key or wrong account

### Method B: Check All Your Google Cloud Projects

1. Go to: https://console.cloud.google.com/
2. Click the project selector (top bar)
3. You'll see a list of all projects across all accounts
4. For each project, check:
   - Go to "APIs & Services" → "Credentials"
   - Look for your API key
   - When you find it, note the project name

## Step 3: Enable Places API in the Correct Project

Once you've identified the correct project:

1. **Select the correct project** in Google Cloud Console
2. **Go to APIs & Services → Library**
3. **Search for "Places API"** (legacy version)
4. **Click on "Places API"** (the one by Google, not "Places API New")
5. **Click "Enable"**
6. **Wait 1-2 minutes** for changes to propagate

## Step 4: Verify API Key Restrictions

1. In the same project, go to: **APIs & Services → Credentials**
2. **Find your API key** (`AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg`)
3. **Click to edit it**
4. **Under "API restrictions":**
   - Make sure "Places API" is checked (if using restrictions)
   - OR temporarily set to "Don't restrict key" for testing

## Step 5: Test Again

After enabling:
1. Refresh your browser page
2. Check console for: `✓ Google Places API loaded successfully`
3. Try typing in the address field

## Alternative: Use the Same Google Account

If this is too complicated, you could:
1. Use the same Google account that has the other keys (GOOGLE_API_KEY, GOOGLE_PSE_ID)
2. Create a new API key in that project
3. Enable Places API in that project
4. Update `.env.local` with the new key

## Quick Test Command

To test if your API key works with Places API, you can run:

```bash
curl "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=test&key=YOUR_API_KEY"
```

Replace `YOUR_API_KEY` with your actual key. If it returns an error about the API not being enabled, you're in the right project and just need to enable it.

