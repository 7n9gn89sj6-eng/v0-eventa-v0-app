export const runtime = "nodejs";

export async function GET() {
  const required = [
    "EMAIL_SERVER_HOST",
    "EMAIL_SERVER_PORT",
    "EMAIL_SERVER_USER",
    "EMAIL_SERVER_PASSWORD",
    "EMAIL_FROM",
  ] as const;

  const missing: string[] = [];
  for (const key of required) {
    if (!process.env[key] || String(process.env[key]).trim() === "") {
      missing.push(key);
    }
  }

  const ok = missing.length === 0;

  const payload = {
    ok,
    missing,
    values: {
      host: process.env.EMAIL_SERVER_HOST ?? null,
      port: process.env.EMAIL_SERVER_PORT ?? null,
      user: process.env.EMAIL_SERVER_USER ?? null,
      from: process.env.EMAIL_FROM ?? null,
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { "content-type": "application/json" },
  });
}
