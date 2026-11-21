import type { CallRecord, Classification, TranscriptLine } from "./calls";

// Server-only client for the call log the Rust backend keeps in SQLite
// (backend/src/calls.rs). Used by the shared call store to record calls and by
// /api/calls to list them for the calls overview page.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function listCalls(status?: "active" | "ended"): Promise<CallRecord[]> {
  return request("GET", `/api/calls${status ? `?status=${status}` : ""}`);
}

export function createCall(call: {
  sourceId: string;
  label: string;
  location: string;
  startedAt: number;
}): Promise<CallRecord> {
  return request("POST", "/api/calls", call);
}

export function updateCall(
  id: number,
  patch: {
    status?: "active" | "ended";
    endedAt?: number;
    assessment?: Classification;
    transcript?: TranscriptLine[];
  },
): Promise<CallRecord> {
  return request("PATCH", `/api/calls/${id}`, patch);
}

export function endActiveCalls(): Promise<void> {
  return request("POST", "/api/calls/end-active");
}
