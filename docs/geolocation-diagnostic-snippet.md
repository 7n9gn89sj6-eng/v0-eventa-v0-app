# Geolocation diagnostic snippet

Use this to test **raw** `navigator.geolocation.getCurrentPosition` with conservative options (no Eventa wrapper). Paste into the browser console on your app origin (e.g. localhost or production).

## Console snippet (copy-paste)

```javascript
// Minimal conservative getCurrentPosition – run in DevTools console on Eventa origin
(function testGeolocation() {
  if (!navigator.geolocation) {
    console.log("[Diagnostic] Geolocation not available");
    return;
  }
  const opts = { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 };
  console.log("[Diagnostic] Calling getCurrentPosition with:", JSON.stringify(opts));
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      console.log("[Diagnostic] SUCCESS:", { lat: pos.coords.latitude, lng: pos.coords.longitude });
    },
    function (err) {
      console.log("[Diagnostic] ERROR:", { code: err.code, message: err.message || undefined });
    },
    opts
  );
})();
```

## Optional: from console after loading Eventa

If the app has attached the helper to `window`:

```javascript
window.__EVENTA_GEOLOCATION_TEST__();
```

## Compare

- **Diagnostic:** single call, `enableHighAccuracy: false`, `timeout: 20000`, `maximumAge: 0`.
- **Eventa (user button):** attempt 1 = same options; attempts 2–3 use longer timeouts and last attempt uses `enableHighAccuracy: true`.

If the diagnostic succeeds but Eventa still fails, the difference is in retry timing or in the wrapper flow rather than the first-call options.
