// Server-side proxy to the Rust triage backend. The browser only talks to
// Next.js; Next.js talks to the backend over the local/internal network, so
// the backend never needs to be exposed publicly. BACKEND_URL is read at
// runtime, so it can be changed without rebuilding.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: Request): Promise<Response> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      signal: request.signal,
      cache: "no-store",
    });
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("Backend request failed:", err);
    return Response.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
