import {
  type CallState,
  type Role,
  type TranscriptLine,
  MICROPHONE_SOURCE_ID,
  scenarios,
} from "./calls";
import { createCall, endActiveCalls, updateCall } from "./callLog";
import { classifyTranscript } from "./classify";

// Server-only, in-memory store for the one shared demo call. Every device
// subscribes to it through /api/call/events and changes it through the Server
// Actions in callActions.ts. It lives in this Next.js server process, so it
// resets on restart and is not shared between multiple server instances.
// Every call is also recorded in the backend's SQLite call log (see logCall).

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
const g = globalThis as typeof globalThis & { __callStore?: Store; __callLog?: CallLog };
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
    floor: null,
  },
  listeners: new Map(),
  playback: null,
  classifySeq: 0,
  appliedSeq: 0,
});

// --- Call log ---------------------------------------------------------------
// Writes go through one queue so the backend sees them in order, and a slow or
// missing backend never blocks the call itself.

type CallLog = { queue: Promise<void>; ids: Map<number, number> };

const log: CallLog = (g.__callLog ??= {
  // A fresh server process has lost the calls the previous one was running.
  queue: endActiveCalls().catch((err) => console.error("Call log: could not close stale calls:", err)),
  ids: new Map(),
});

function enqueue(task: () => Promise<unknown>) {
  log.queue = log.queue.then(task).then(
    () => {},
    (err) => console.error("Call log write failed:", err),
  );
}

function logCreate(callId: number, sourceId: string, startedAt: number) {
  const scenario = scenarios.find((s) => s.id === sourceId);
  enqueue(async () => {
    const record = await createCall({
      sourceId,
      label: scenario?.label ?? "Live call",
      location: scenario?.location ?? "Not provided",
      startedAt,
    });
    log.ids.set(callId, record.id);
  });
}

function logUpdate(callId: number, patch: Parameters<typeof updateCall>[1]) {
  enqueue(async () => {
    const id = log.ids.get(callId);
    if (id !== undefined) await updateCall(id, patch);
  });
}

function logEnd(callId: number, endedAt: number) {
  logUpdate(callId, { status: "ended", endedAt });
  enqueue(async () => log.ids.delete(callId));
}

export function getState(): CallState {
  const participants: Record<Role, number> = { responder: 0, caller: 0 };
  for (const role of store.listeners.values()) participants[role]++;
  // `?? null`: a store created before `floor` existed survives hot reloads.
  return { ...store.state, floor: store.state.floor ?? null, participants, serverNow: Date.now() };
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
  if (store.state.status === "active") logEnd(store.state.callId, Date.now());
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
    // The responder answers, so they speak first on a live call.
    floor: sourceId === MICROPHONE_SOURCE_ID ? "responder" : null,
  };
  logCreate(store.state.callId, sourceId, store.state.startedAt!);
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
  store.state = { ...store.state, status: "ended", endedAt: Date.now(), floor: null };
  logEnd(store.state.callId, store.state.endedAt!);
  broadcast();
}

// Turns `role`'s microphone on (muting the other side), or everyone's off.
export function setFloor(role: Role | null) {
  const { status, sourceId } = store.state;
  if (status !== "active" || sourceId !== MICROPHONE_SOURCE_ID) throw new Error("No live call in progress");
  if (store.state.floor === role) return;
  store.state = { ...store.state, floor: role };
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
  logUpdate(store.state.callId, { transcript: store.state.lines });
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
    logUpdate(callId, { assessment: value });
  } catch (err) {
    if (seq < store.appliedSeq || store.state.callId !== callId) return;
    store.state = {
      ...store.state,
      backendError: err instanceof Error ? err.message : "Backend unavailable",
    };
  }
  broadcast();
}
