/** Render / load-balancer liveness: no DB, env, or external calls. */
export function GET() {
  return new Response("ok", { status: 200 })
}
