"use server";

import type { Speaker } from "./calls";
import * as call from "./callStore";

// Server Actions that change the shared call. Devices see the result through
// the /api/call/events stream, so these return nothing.

const MAX_LINE_LENGTH = 2000;

export async function startCall(sourceId: string): Promise<void> {
  if (typeof sourceId !== "string") throw new Error("Invalid call source");
  call.startCall(sourceId);
}

export async function endCall(): Promise<void> {
  call.endCall();
}

export async function addLine(speaker: Speaker, text: string): Promise<void> {
  if (speaker !== "Caller" && speaker !== "Operator") throw new Error("Invalid speaker");
  if (typeof text !== "string") throw new Error("Invalid text");
  const trimmed = text.trim().slice(0, MAX_LINE_LENGTH);
  if (!trimmed) return;
  call.addLine({ speaker, text: trimmed[0].toUpperCase() + trimmed.slice(1) });
}
