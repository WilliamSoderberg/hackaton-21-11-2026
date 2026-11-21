import { connection, type NextRequest } from "next/server";
import type { Role } from "../../../lib/calls";
import { subscribe } from "../../../lib/callStore";

// Server-sent events stream of the shared call state. Each device keeps one
// open; `role` is only used to show who is connected.
export async function GET(request: NextRequest) {
  await connection(); // always run at request time, never prerender
  const role: Role = request.nextUrl.searchParams.get("role") === "caller" ? "caller" : "responder";
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = subscribe(role, (state) => send(`data: ${JSON.stringify(state)}\n\n`));
      // Comment lines keep proxies and browsers from timing out an idle stream.
      const keepAlive = setInterval(() => send(": ping\n\n"), 15_000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
