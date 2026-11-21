"use server";

import type { Classification, TranscriptLine } from "./calls";

// Server Action that forwards the transcript to the Rust triage backend
// (backend/src). It runs on the Next.js server, so the backend never needs to
// be reachable from the browser. BACKEND_URL is read at runtime, so it can be
// changed without rebuilding.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function classifyTranscript(lines: TranscriptLine[]): Promise<Classification> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("Backend request failed:", err);
    throw new Error("Backend unavailable");
  }
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}
