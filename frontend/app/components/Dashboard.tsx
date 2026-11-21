"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type CallState,
  type Classification,
  type Role,
  type Scenario,
  type TranscriptLine,
  type Urgency,
  MICROPHONE_SOURCE_ID,
  emptyClassification,
  roleSpeaker,
  scenarios,
  speakerLabel,
} from "../lib/calls";
import { type AmbulancePrediction, predictAmbulance } from "../lib/ambulanceModel";
import { addLine, endCall, setFloor, startCall } from "../lib/callActions";
import { downloadCallSummary } from "../lib/summaryPdf";
import { useSharedCall } from "../lib/useSharedCall";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "../lib/useSpeechRecognition";
import AppNav from "./AppNav";

// The assessment keywords are English, so recognise English speech.
const SPEECH_LANG = "en-US";

// Live calls come from the participants' microphones.
const microphoneSource: Scenario = {
  id: MICROPHONE_SOURCE_ID,
  label: "Live call",
  location: "Not provided",
  transcript: [],
};
const sources = [microphoneSource, ...scenarios];

const urgencyOrder: Urgency[] = ["Low", "Medium", "High", "Critical"];

const urgencyStyles: Record<Urgency, { bar: string; text: string }> = {
  Low: { bar: "bg-emerald-700", text: "text-emerald-800" },
  Medium: { bar: "bg-amber-500", text: "text-amber-800" },
  High: { bar: "bg-orange-700", text: "text-orange-800" },
  Critical: { bar: "bg-red-800", text: "text-red-800" },
};

// --- Role: which side of the call this device is on -----------------------
// Remembered per device; ?role=caller or ?role=responder in the URL wins.

const ROLE_KEY = "call-role";
const roleListeners = new Set<() => void>();

function readRole(): Role {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("role");
    if (fromUrl === "caller" || fromUrl === "responder") return fromUrl;
    return localStorage.getItem(ROLE_KEY) === "caller" ? "caller" : "responder";
  } catch {
    return "responder";
  }
}

function writeRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role);
    const url = new URL(window.location.href);
    url.searchParams.set("role", role);
    window.history.replaceState(null, "", url);
  } catch {}
  roleListeners.forEach((l) => l());
}

function useRole(): [Role, (role: Role) => void] {
  const role = useSyncExternalStore(
    (onChange) => {
      roleListeners.add(onChange);
      return () => roleListeners.delete(onChange);
    },
    readRole,
    (): Role => "responder",
  );
  return [role, writeRole];
}

// Ticks once a second while a call is active; returns its duration in ms.
function useCallDuration(state: CallState | null, clockOffset: number) {
  // Starts at 0: the clock is only read in timers, never while rendering, so
  // the page can still be prerendered.
  const [now, setNow] = useState(0);
  const active = state?.status === "active";
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);
  if (!state?.startedAt || (!state.endedAt && !now)) return 0;
  const end = state.endedAt ?? now + clockOffset;
  return Math.max(0, end - state.startedAt);
}

// Re-reads the conversation every 2 s and asks the trained ambulance model
// (lib/ambulanceModel.ts) whether it needs an ambulance. Null until there is text.
const AMBULANCE_MODEL_MS = 2000;

function useAmbulanceModel(lines: TranscriptLine[]): AmbulancePrediction | null {
  const latest = useRef(lines);
  const [prediction, setPrediction] = useState<AmbulancePrediction | null>(null);
  useEffect(() => {
    latest.current = lines;
  }, [lines]);
  useEffect(() => {
    const evaluate = () => {
      const turns = latest.current.map((l) => l.text);
      setPrediction(turns.length ? predictAmbulance(turns) : null);
    };
    const first = setTimeout(evaluate, 0);
    const timer = setInterval(evaluate, AMBULANCE_MODEL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return prediction;
}

// Transcribes this device's microphone into the shared call as `role`.
function useMicrophone(role: Role, listening: boolean) {
  const [error, setError] = useState<string | null>(null);
  const interim = useSpeechRecognition({
    listening,
    lang: SPEECH_LANG,
    onFinal: (text) => {
      addLine(roleSpeaker[role], text).catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not send transcript"),
      );
    },
    onError: setError,
  });
  return { interim, error, setError };
}

export default function Dashboard() {
  const [role, setRole] = useRole();
  const { state, connected, clockOffset } = useSharedCall(role);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {role === "responder" ? (
        <ResponderView state={state} connected={connected} clockOffset={clockOffset} role={role} setRole={setRole} />
      ) : (
        <CallerView state={state} connected={connected} clockOffset={clockOffset} role={role} setRole={setRole} />
      )}
    </div>
  );
}

type ViewProps = {
  state: CallState | null;
  connected: boolean;
  clockOffset: number;
  role: Role;
  setRole: (role: Role) => void;
};

function Header({
  subtitle,
  role,
  setRole,
  state,
  connected,
  children,
}: {
  subtitle: string;
  role: Role;
  setRole: (role: Role) => void;
  state: CallState | null;
  connected: boolean;
  children?: React.ReactNode;
}) {
  const other: Role = role === "responder" ? "caller" : "responder";
  const otherCount = state?.participants[other] ?? 0;
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-800 text-lg font-semibold text-white">+</span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Emergency Call Dashboard</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {/* The crew page is for the responder side, not the person calling. */}
        {role === "responder" && <AppNav />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-500" title="Devices connected to the shared call">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-600" : "bg-slate-300"}`} />
          {!connected
            ? "Connecting…"
            : otherCount
              ? `${speakerLabel[roleSpeaker[other]]} connected`
              : `No ${speakerLabel[roleSpeaker[other]].toLowerCase()} connected`}
        </span>
        <div
          role="radiogroup"
          aria-label="I am the"
          className="flex rounded-md bg-slate-100 p-0.5 text-sm ring-1 ring-slate-200"
        >
          {(["responder", "caller"] as const).map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={`rounded px-3 py-1.5 font-medium ${
                role === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {r === "responder" ? "Responder" : "Caller"}
            </button>
          ))}
        </div>
        {children}
      </div>
    </header>
  );
}

function ResponderView({ state, connected, clockOffset, role, setRole }: ViewProps) {
  const [sourceId, setSourceId] = useState(MICROPHONE_SOURCE_ID);
  const [notes, setNotes] = useState("");
  const [notesCallId, setNotesCallId] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const status = state?.status ?? "idle";
  const active = status === "active";
  const lines = state?.lines ?? [];
  // While a call is on, show the source it was started with, on every device.
  const scenario = sources.find((s) => s.id === (status === "idle" ? sourceId : state?.sourceId)) ?? microphoneSource;
  const usingMic = scenario.id === MICROPHONE_SOURCE_ID;
  const elapsed = useCallDuration(state, clockOffset);
  const micOn = active && usingMic && state?.floor === role;
  const mic = useMicrophone(role, micOn);
  const toggleMic = useTalkToggle(role, micOn, mic.setError);

  // Notes belong to one call; clear them when a new one starts.
  if (state && state.callId !== notesCallId) {
    setNotesCallId(state.callId);
    setNotes("");
  }

  const callerLineCount = lines.filter((l) => l.speaker === "Caller").length;
  const assessment = state?.assessment;
  const classification = callerLineCount && assessment ? assessment.value : emptyClassification;
  const backendError = state?.backendError ?? null;
  const analysing = callerLineCount > 0 && assessment?.callerLineCount !== callerLineCount && !backendError;
  const ambulanceModel = useAmbulanceModel(lines);

  function run(action: () => Promise<void>) {
    setActionError(null);
    action().catch((err: unknown) => setActionError(err instanceof Error ? err.message : "Request failed"));
  }

  function answerCall() {
    if (usingMic && !isSpeechRecognitionSupported()) {
      mic.setError("This browser does not support speech recognition. Use Chrome or Edge.");
      return;
    }
    mic.setError(null);
    // The server gives the responder the floor, which unmutes this mic.
    run(() => startCall(sourceId));
  }

  async function downloadSummary() {
    setExporting(true);
    try {
      await downloadCallSummary({
        incident: scenario.label,
        location: scenario.location,
        startedAt: state?.startedAt ? new Date(state.startedAt) : null,
        duration: formatDuration(elapsed),
        status: active ? "In progress" : "Ended",
        classification,
        notes,
        lines,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Header subtitle="Dispatcher console" role={role} setRole={setRole} state={state} connected={connected}>
        <select
          value={active ? scenario.id : sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          disabled={active}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          aria-label="Call source"
        >
          <option value={MICROPHONE_SOURCE_ID}>Live call: microphones</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              Simulate: {s.label}
            </option>
          ))}
        </select>
        {active ? (
          <button
            onClick={() => run(endCall)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            End call
          </button>
        ) : (
          <button
            onClick={answerCall}
            disabled={!connected}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Answer call
          </button>
        )}
      </Header>

      <main className="grid gap-4 p-4 lg:grid-cols-3 lg:p-6">
        {/* Segment 1: assessment of the current call */}
        <section className="flex flex-col gap-4 lg:col-span-1">
          <Panel
            title="Live assessment"
            subtitle={analysing ? "Analysing…" : active ? "Updating from caller's words" : "Waiting for call"}
          >
            {backendError && (
              <p className="mb-3 rounded-lg bg-red-50/60 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
                Assessment backend unreachable ({backendError}). Start it with <code>cargo run</code> in backend/.
              </p>
            )}
            <UrgencyMeter classification={classification} />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <AmbulanceTile prediction={ambulanceModel} />
              <Stat label="Location" value={lines.length ? scenario.location : "—"} />
            </div>
            <div className="mt-5">
              <SplitBar physical={classification.physical} mental={classification.mental} />
            </div>
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Detected indicators</h3>
              {classification.indicators.length ? (
                <ul className="flex flex-wrap gap-2">
                  {classification.indicators.map((i) => (
                    <li key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {i}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">None yet</p>
              )}
            </div>
            {classification.sources && (
              <p className="mt-4 text-[11px] text-slate-400">
                Triage: {classification.sources.triage} model · Indicators: {classification.sources.indicators} model
              </p>
            )}
          </Panel>

          <Panel title="Current call" subtitle={lines.length ? scenario.label : "No patient yet"}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Incident" value={lines.length ? scenario.label : "—"} />
              <Stat
                label="Primary concern"
                value={
                  classification.indicators.length
                    ? classification.physical >= classification.mental
                      ? "Physical"
                      : "Mental"
                    : "—"
                }
              />
              <Stat label="Call duration" value={status !== "idle" ? formatDuration(elapsed) : "—"} />
              <Stat label="Status" value={active ? "In progress" : status === "ended" ? "Ended" : "Idle"} />
            </div>
          </Panel>
        </section>

        {/* Segment 2: AI transcription */}
        <section className="lg:col-span-1">
          <Panel
            title="AI transcription"
            subtitle={active ? `Live · ${formatDuration(elapsed)}` : status === "ended" ? "Call ended" : "Idle"}
            live={active}
            className="h-full"
          >
            <div className="h-[32rem] overflow-y-auto pr-1 lg:h-[calc(100vh-14rem)]">
              {active && usingMic && (
                <TalkControl role={role} floor={state?.floor ?? null} micOn={micOn} onToggle={toggleMic} compact />
              )}
              <ErrorNote message={actionError ?? mic.error} />
              <Transcript
                lines={lines}
                interim={mic.interim}
                me={roleSpeaker[role]}
                pending={active && (usingMic ? !mic.interim : lines.length < scenario.transcript.length)}
                empty={
                  active && usingMic ? (
                    micOn ? "Listening… start speaking." : "Tap the microphone to speak."
                  ) : (
                    <>
                      Press <span className="font-semibold text-slate-600">Answer call</span> to start transcribing
                      {usingMic && " from the responder's and caller's microphones"}.
                    </>
                  )
                }
              />
            </div>
          </Panel>
        </section>

        {/* Segment 3: dispatcher notes */}
        <section className="flex flex-col gap-4 lg:col-span-1">
          <Panel title="Dispatcher notes" subtitle="Anything the transcriber missed">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Background noise, caller's tone, landmarks, extra details…"
              className="h-[32rem] w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none lg:h-[calc(100vh-15.5rem)]"
            />
            <p className="mt-2 text-xs text-slate-400">Notes are included in the PDF summary.</p>
          </Panel>
        </section>
      </main>

      <button
        onClick={downloadSummary}
        disabled={lines.length === 0 || exporting}
        className="fixed right-6 bottom-6 flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        title={lines.length ? "Download a PDF summary of this call" : "Answer a call first"}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" />
        </svg>
        {exporting ? "Generating…" : "Download PDF summary"}
      </button>
    </>
  );
}

// The person calling in. They only see the conversation, not the triage.
function CallerView({ state, connected, clockOffset, role, setRole }: ViewProps) {
  // The caller taps to speak; that mutes the responder's mic, and vice versa.
  const status = state?.status ?? "idle";
  const active = status === "active";
  const live = active && state?.sourceId === MICROPHONE_SOURCE_ID;
  const lines = state?.lines ?? [];
  const elapsed = useCallDuration(state, clockOffset);
  const micOn = live && state?.floor === role;
  const mic = useMicrophone(role, micOn);
  const toggleMic = useTalkToggle(role, micOn, mic.setError);

  return (
    <>
      <Header subtitle="Caller" role={role} setRole={setRole} state={state} connected={connected} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 lg:p-6">
        <Panel
          title={active ? "On a call with emergency services" : status === "ended" ? "Call ended" : "Not in a call"}
          subtitle={status !== "idle" ? formatDuration(elapsed) : undefined}
          live={active}
        >
          {active && live ? (
            <TalkControl role={role} floor={state?.floor ?? null} micOn={micOn} onToggle={toggleMic} />
          ) : (
            <p className="py-2 text-sm text-slate-500">
              {active
                ? "The responder is playing a scripted call, so your microphone isn't used."
                : status === "ended"
                  ? "The responder ended the call."
                  : "Waiting for the responder to answer. Your microphone turns on when you tap it once the call starts."}
            </p>
          )}
        </Panel>

        <Panel title="Conversation" subtitle={active ? "Live" : undefined} live={active}>
          <div className="max-h-[60vh] min-h-48 overflow-y-auto pr-1">
            <ErrorNote message={mic.error} />
            <Transcript
              lines={lines}
              interim={mic.interim}
              me={roleSpeaker[role]}
              pending={false}
              empty="Nothing said yet."
            />
          </div>
        </Panel>
      </main>
    </>
  );
}

function Transcript({
  lines,
  interim,
  me,
  pending,
  empty,
}: {
  lines: TranscriptLine[];
  interim: string;
  me: TranscriptLine["speaker"];
  pending: boolean;
  empty: React.ReactNode;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines.length, interim]);

  if (lines.length === 0 && !interim) {
    return <p className="mt-10 text-center text-sm text-slate-400">{empty}</p>;
  }
  return (
    <>
      <ol className="flex flex-col gap-3">
        {lines.map((line, i) => (
          <li key={i} className={line.speaker === "Caller" ? "pr-6" : "pl-6"}>
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                line.speaker === "Caller" ? "bg-slate-100" : "bg-white text-slate-800 ring-1 ring-slate-200"
              }`}
            >
              <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {speakerLabel[line.speaker]}
              </span>
              {line.text}
            </div>
          </li>
        ))}
        {interim && (
          <li className={me === "Caller" ? "pr-6" : "pl-6"}>
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm italic text-slate-500">
              {interim}…
            </div>
          </li>
        )}
        {pending && (
          <li className="flex gap-1 px-3 text-slate-400" aria-label="Transcribing">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse [animation-delay:150ms]">●</span>
            <span className="animate-pulse [animation-delay:300ms]">●</span>
          </li>
        )}
      </ol>
      <div ref={end} />
    </>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mb-3 rounded-lg bg-red-50/60 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{message}</p>;
}

// Tap to speak. Taking the floor mutes the other side's microphone, so two
// mics in one room never transcribe the same voice twice.
function useTalkToggle(role: Role, micOn: boolean, setError: (message: string | null) => void) {
  return () => {
    if (!micOn && !isSpeechRecognitionSupported()) {
      setError("This browser does not support speech recognition. Use Chrome or Edge.");
      return;
    }
    setError(null);
    setFloor(micOn ? null : role).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not switch the microphone"),
    );
  };
}

function TalkControl({
  role,
  floor,
  micOn,
  onToggle,
  compact = false,
}: {
  role: Role;
  floor: Role | null;
  micOn: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const other = speakerLabel[roleSpeaker[role === "responder" ? "caller" : "responder"]].toLowerCase();
  const hint = micOn
    ? "You're speaking. Tap when you're done."
    : floor && floor !== role
      ? `The ${other} is speaking. Tap to speak instead.`
      : "Tap to speak.";
  return (
    <div
      className={
        compact
          ? "mb-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200"
          : "flex flex-col items-center gap-3 py-2"
      }
    >
      <button
        onClick={onToggle}
        className={`grid shrink-0 place-items-center rounded-full text-white shadow-lg transition-colors ${
          compact ? "h-12 w-12" : "h-20 w-20"
        } ${micOn ? "bg-red-800 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-700"}`}
        aria-pressed={micOn}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
      >
        <MicIcon off={!micOn} className={compact ? "h-5 w-5" : "h-8 w-8"} />
      </button>
      <p className="text-sm text-slate-500">
        {micOn && <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-700" />}
        {hint}
      </p>
    </div>
  );
}

function MicIcon({ off, className }: { off: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function Panel({
  title,
  subtitle,
  live,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm p-4 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            {live && <span className="h-2 w-2 animate-pulse rounded-full bg-red-700" />}
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function UrgencyMeter({ classification }: { classification: Classification }) {
  const { urgency, urgencyScore } = classification;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Urgency</span>
        <span className={`text-2xl font-bold ${urgencyScore ? urgencyStyles[urgency].text : "text-slate-400"}`}>
          {urgencyScore ? urgency : "—"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {urgencyOrder.map((level, i) => {
          const reached = urgencyScore > 0 && urgencyOrder.indexOf(urgency) >= i;
          return (
            <div key={level} className="flex flex-col gap-1">
              <div
                className={`h-2.5 rounded-sm transition-colors duration-500 ${
                  reached ? urgencyStyles[urgency].bar : "bg-slate-100"
                }`}
              />
              <span className="text-[10px] text-slate-400">{level}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shows the trained model's verdict (updated every 2 s), not the backend's.
function AmbulanceTile({ prediction }: { prediction: AmbulancePrediction | null }) {
  const hasData = prediction !== null;
  const ambulance = prediction?.ambulance ?? false;
  return (
    <div
      className={`rounded-lg p-3 ring-1 ${
        !hasData
          ? "bg-slate-50 ring-slate-200"
          : ambulance
            ? "bg-red-50/50 ring-red-800/20"
            : "bg-emerald-50/50 ring-emerald-800/20"
      }`}
    >
      <span className="text-xs text-slate-500">Ambulance</span>
      <p
        className={`text-xl font-bold ${
          !hasData ? "text-slate-400" : ambulance ? "text-red-800" : "text-emerald-800"
        }`}
      >
        {!hasData ? "—" : ambulance ? "Yes" : "No"}
      </p>
      <span className="text-[11px] text-slate-400">
        {hasData ? `Trained model · ${Math.round(prediction.probability * 100)}%` : "Trained model · every 2 s"}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <span className="text-xs text-slate-500">{label}</span>
      <p className="truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

function SplitBar({ physical, mental }: { physical: number; mental: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="text-slate-700">Physical {physical}%</span>
        <span className="text-slate-500">Mental {mental}%</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-slate-600 transition-all duration-500" style={{ width: `${physical}%` }} />
        <div className="bg-slate-400 transition-all duration-500" style={{ width: `${mental}%` }} />
      </div>
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
