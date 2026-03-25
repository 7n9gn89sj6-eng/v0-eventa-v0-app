# Geolocation fix: test steps, deploy, and expected console output

## 1. Exact local test steps

1. **Install and run**
   ```bash
   cd path/to/this/repo
   npm install
   npm run dev
   ```

2. **Open app**
   - Browser: `http://localhost:3000`
   - Open DevTools → Console (leave it open for all steps)

3. **Test top Location button (header)**
   - Click the **Location** button in the header (top right, next to Browse).
   - If location already set: it should clear and show the MapPin again.
   - If no location: it should show "Finding your location…", then either set location (city name + checkmark) or show an inline error under the header.
   - Check console for any `[Geolocation]` logs.

4. **Test small location icon (next to Go)**
   - On the home page, find the **MapPin** button to the left of the **Go** button.
   - Click it. Same flow: loading → success (city + checkmark) or error message below the bar.
   - Check console for `[Geolocation]` logs.

5. **Test permission denied (optional)**
   - Reload the page.
   - In DevTools → Application (or Site settings) → Permissions, set **Location** to **Block**.
   - Click either location button.
   - Expect: error message and in console: `[Geolocation]` with `type: "permission_denied"`.

6. **Test with permission allowed again**
   - Set Location back to **Allow** (or **Prompt**).
   - Click a location button again to confirm normal flow or retries.

7. **Test “clear location”**
   - After a successful location, click the same button again; location should clear (back to MapPin, no city).

---

## 2. Exact Render redeploy steps

1. **Commit and push**
   ```bash
   cd path/to/this/repo
   git add lib/location-context.tsx components/layout/site-header.tsx components/search/smart-input-bar.tsx
   git commit -m "fix(geolocation): shared handler, retries, structured logging, both buttons"
   git push origin main
   ```

2. **Render**
   - Open [Render Dashboard](https://dashboard.render.com/).
   - Select the **Eventa** service (web service).
   - If auto-deploy is on for `main`, a deploy will start after push; otherwise click **Manual Deploy** → **Deploy latest commit**.
   - Wait until the deploy status is **Live**.

3. **Verify on production**
   - Open your production URL (HTTPS).
   - Repeat the same tests as local (header Location button, MapPin next to Go, permission block, then allow).
   - Check browser console for `[Geolocation]` logs; check Render **Logs** for `[geocode/reverse]` if you simulate reverse geocode failure.

---

## 3. Expected console output

All geolocation logs use the prefix **`[Geolocation]`** and a single object. Use these to tell apart failure types.

### Permission denied

- **When:** User blocks location or dismisses the permission prompt.
- **Console (browser):**
  ```text
  [Geolocation] { type: "permission_denied", code: 1, message: "<browser message or undefined>" }
  ```
- **UI:** Inline message: “Location permission was denied. You can still search by entering a city name.”

---

### Timeout

- **When:** Browser does not get a position within 15s; may log once per attempt up to `maxRetries` (e.g. 3).
- **Console (browser):**
  ```text
  [Geolocation] { type: "timeout", code: 3, message: "...", attempt: 1, maxRetries: 3 }
  ```
  (If retries occur, you’ll see `attempt: 2`, then `attempt: 3`.)
- **UI (after all retries):** “Location request timed out. You can still search by entering a city name.”

---

### Position unavailable (e.g. kCLErrorLocationUnknown)

- **When:** Browser returns position unavailable (e.g. GPS off, weak signal, CoreLocation `kCLErrorLocationUnknown`).
- **Console (browser):**
  ```text
  [Geolocation] { type: "position_unavailable", code: 2, message: "...", attempt: 1, maxRetries: 3 }
  ```
  (Retries may produce more lines with `attempt: 2`, `attempt: 3`. Last attempt may include `enableHighAccuracy: true`.)
- **UI (after all retries):** “We couldn’t determine your location right now (e.g. GPS off or weak signal). You can still search by city name.”

---

### Reverse geocode failure

- **When:** Coordinates were obtained but `/api/geocode/reverse` fails (non-OK status or network/abort error).
- **Console (browser):**
  - If API returns non-OK (e.g. 500):
    ```text
    [Geolocation] { type: "reverse_geocode_failure", status: 500, message: "Internal Server Error" }
    ```
  - If fetch throws (network/abort):
    ```text
    [Geolocation] { type: "reverse_geocode_failure", message: "<error message>" }
    ```
- **UI:** Location is still set as “Current location” (with lat/lng); no error is shown. User can search by city as usual.
- **Server (Render logs):** Look for `[geocode/reverse]` lines, e.g.:
  ```text
  [geocode/reverse] Nominatim API error: 500 - ...
  ```
  or
  ```text
  [geocode/reverse] Reverse geocoding failed: <error>
  ```

---

### Boot-time geolocation (background attempt)

- **When:** App loads and context tries geolocation in the background (no button click).
- **Console (browser) on failure:**
  ```text
  [Geolocation] { type: "permission_denied" | "timeout" | "position_unavailable", code: <1|2|3>, message: "..." }
  ```
  No UI is shown for this; it’s non-blocking.
