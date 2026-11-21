import {
  type CallState,
  type Role,
  type TranscriptLine,
  MICROPHONE_SOURCE_ID,
  scenarios,
} from "./calls";
import { classifyTranscript } from "./classify";

// Server-only, in-memory store for the one shared demo call. Every device
// subscribes to it through /api/call/events and changes it through the Server
// Actions in callActions.ts. It lives in this Next.js server process, so it
// resets on restart and is not shared between multiple server instances.

const LINE_INTERVAL_MS = 2200;
const MAX_LINES = 500;

type Listener = (state: CallState) => void;

type Store = {
  state: Omit<CallState, "participants" | "serverNow">;
  listeners: Map<Listener, Role>;
  playback: ReturnType<typeof setInterval> | null;
  classifySeq: number;
  appliedSeq: number;
};

// Kept on globalThis so dev-server hot reloads don't reset the call.
const g = globalThis as typeof globalThis & { __callStore?: Store };
const store: Store = (g.__callStore ??= {
  state: {
    callId: 0,
    status: "idle",
    sourceId: MICROPHONE_SOURCE_ID,
    startedAt: null,
    endedAt: null,
    lines: [],
    assessment: null,
    backendError: null,
  },
  listeners: new Map(),
  playback: null,
  classifySeq: 0,
  appliedSeq: 0,
});

export function getState(): CallState {
  const participants: Record<Role, number> = { responder: 0, caller: 0 };
  for (const role of store.listeners.values()) participants[role]++;
  return { ...store.state, participants, serverNow: Date.now() };
}

function broadcast() {
  const state = getState();
  for (const listener of store.listeners.keys()) listener(state);
}

export function subscribe(role: Role, listener: Listener): () => void {
  store.listeners.set(listener, role);
  broadcast(); // includes the new listener, and updates everyone's participant count
  return () => {
    store.listeners.delete(listener);
    broadcast();
  };
}

function stopPlayback() {
  if (store.playback) clearInterval(store.playback);
  store.playback = null;
}

export function startCall(sourceId: string) {
  const scenario = scenarios.find((s) => s.id === sourceId);
  if (!scenario && sourceId !== MICROPHONE_SOURCE_ID) throw new Error("Unknown call source");
  stopPlayback();
  // Ignore assessments still in flight from the previous call.
  store.appliedSeq = ++store.classifySeq;
  store.state = {
    callId: store.state.callId + 1,
    status: "active",
    sourceId,
    startedAt: Date.now(),
    endedAt: null,
    lines: [],
    assessment: null,
    backendError: null,
  };
  broadcast();

  if (scenario) {
    // Play the scripted call on the server so every device sees the same lines.
    const callId = store.state.callId;
    const next = () => {
      const { lines, status } = store.state;
      if (store.state.callId !== callId || status !== "active" || lines.length >= scenario.transcript.length) {
        if (store.state.callId === callId) stopPlayback();
        return;
      }
      pushLine(scenario.transcript[lines.length]);
    };
    next();
    store.playback = setInterval(next, LINE_INTERVAL_MS);
  }
}

export function endCall() {
  if (store.state.status !== "active") return;
  stopPlayback();
  store.state = { ...store.state, status: "ended", endedAt: Date.now() };
  broadcast();
}

export function addLine(line: TranscriptLine) {
  const { status, sourceId } = store.state;
  if (status !== "active") throw new Error("No call in progress");
  if (sourceId !== MICROPHONE_SOURCE_ID) throw new Error("A scripted call is playing");
  pushLine(line);
}

function pushLine(line: TranscriptLine) {
  if (store.state.lines.length >= MAX_LINES) return;
  store.state = { ...store.state, lines: [...store.state.lines, line] };
  broadcast();
  if (line.speaker === "Caller") void reclassify();
}

// Only the caller's own words go to the triage backend; the responder's
// questions would otherwise be mistaken for symptoms.
async function reclassify() {
  const callId = store.state.callId;
  const callerLines = store.state.lines.filter((l) => l.speaker === "Caller");
  const seq = ++store.classifySeq;
  try {
    const value = await classifyTranscript(callerLines);
    if (seq < store.appliedSeq || store.state.callId !== callId) return;
    store.appliedSeq = seq;
    store.state = {
      ...store.state,
      assessment: { callerLineCount: callerLines.length, value },
      backendError: null,
    };
  } catch (err) {
    if (seq < store.appliedSeq || store.state.callId !== callId) return;
    store.state = {
      ...store.state,
      backendError: err instanceof Error ? err.message : "Backend unavailable",
    };
  }
  broadcast();
}
