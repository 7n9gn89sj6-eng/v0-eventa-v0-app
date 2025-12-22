# Enable Places API - Step by Step

## Current Error
```
You're calling a legacy API, which is not enabled for your project.
```

This means the **Places API (Legacy)** is not enabled in your Google Cloud project.

## Your API Key
`AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg`

## Step-by-Step Fix

### Step 1: Identify the Correct Project

1. Go to: https://console.cloud.google.com/
2. **Sign in with the Google account you used to create this API key**
3. Click the **project dropdown** at the top (shows project name)
4. You'll see a list of all projects
5. Click on each project and check:
   - Go to: **APIs & Services** → **Credentials**
   - Look for your API key: `AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg`
   - **When you find it, note the project name** - this is the project you need to work with

### Step 2: Enable Places API (Legacy) in That Project

1. **Make sure you're in the correct project** (the one with your API key)
2. Go to: **APIs & Services** → **Library**
3. Search for: **"Places API"**
4. You'll see TWO options:
   - ✅ **"Places API"** (by Google) - This is the LEGACY one we need
   - ⚠️ "Places API (New)" - This is different, don't enable this one yet
5. Click on **"Places API"** (the legacy one)
6. Click the **"Enable"** button
7. Wait for it to enable (usually 5-10 seconds)

### Step 3: Verify API Key Restrictions

1. Still in the same project, go to: **APIs & Services** → **Credentials**
2. Click on your API key: `AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg`
3. Scroll down to **"API restrictions"**
4. Choose one:
   - **Option A (Easiest for testing):** Select **"Don't restrict key"**
   - **Option B (More secure):** Select **"Restrict key"** and make sure **"Places API"** is checked

### Step 4: Wait and Test

1. **Wait 1-2 minutes** for Google's systems to propagate the changes
2. **Refresh your browser page** (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
3. **Try typing in the address field** - dropdown should appear

## How to Verify It's Enabled

After enabling, test with:

```bash
curl "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=test&key=AIzaSyAoN6cUpD0EHowfA-_Bk_5GFSY0v93Dsfg"
```

**Before enabling:** You'll see `"status": "REQUEST_DENIED"`  
**After enabling:** You should see `"status": "OK"` with predictions

## Common Mistakes

❌ **Wrong API:** Enabling "Places API (New)" instead of "Places API" (Legacy)  
❌ **Wrong Project:** Enabling in a different project than the one with your API key  
❌ **Not Waiting:** Changes take 1-2 minutes to propagate  
❌ **API Key Restrictions:** API key restricted but "Places API" not in allowed list

## Still Not Working?

1. Double-check you're in the correct project (the one with your API key)
2. Make sure "Places API" (Legacy) is enabled, not "Places API (New)"
3. Check API key restrictions allow Places API
4. Wait longer (up to 5 minutes)
5. Try clearing browser cache
6. Restart your dev server

