// tests/smoke.mjs
import http from "http";

const base = process.env.APP_BASE_URL || "http://localhost:3000";
function get(path) {
  return new Promise((resolve, reject) => {
    http.get(base + path, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

(async () => {
  const home = await get("/");
  if (!(home.status >= 200 && home.status < 500)) {
    console.error("❌ Home not reachable", home.status);
    process.exit(1);
  }
  const status = await get("/api/status");
  if (status.status !== 200 || !status.data.includes('"ok":true')) {
    console.error("❌ /api/status failed", status.status, status.data);
    process.exit(1);
  }
  console.log("✅ Smoke tests passed.");
})();
