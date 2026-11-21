import { connection, type NextRequest } from "next/server";
import { listCalls } from "../../lib/callLog";

// The calls overview page polls this; it forwards to the backend's SQLite call
// log so the backend never needs to be reachable from the browser.
export async function GET(request: NextRequest) {
  await connection(); // always run at request time, never prerender
  const param = request.nextUrl.searchParams.get("status");
  const status = param === "active" || param === "ended" ? param : undefined;
  try {
    return Response.json(await listCalls(status), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Listing calls failed:", err);
    return Response.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
