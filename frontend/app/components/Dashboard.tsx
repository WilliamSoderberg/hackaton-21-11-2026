"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Classification,
  type Scenario,
  type TranscriptLine,
  type Urgency,
  emptyClassification,
  scenarios,
} from "../lib/calls";
import { classifyTranscript } from "../lib/classify";
import { downloadCallSummary } from "../lib/summaryPdf";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "../lib/useSpeechRecognition";

const LINE_INTERVAL_MS = 2200;

// The assessment keywords are English, so recognise English speech.
const SPEECH_LANG = "en-US";

// Live calls come from the microphone; everything said is treated as the caller.
const microphoneSource: Scenario = {
  id: "microphone",
  label: "Live call",
  location: "Not provided",
  transcript: [],
};
const sources = [microphoneSource, ...scenarios];

const urgencyOrder: Urgency[] = ["Low", "Medium", "High", "Critical"];

const urgencyStyles: Record<Urgency, { bar: string; text: string }> = {
  Low: { bar: "bg-emerald-500", text: "text-emerald-600" },
  Medium: { bar: "bg-amber-400", text: "text-amber-600" },
  High: { bar: "bg-orange-500", text: "text-orange-600" },
  Critical: { bar: "bg-red-500", text: "text-red-600" },
};

export default function Dashboard() {
  const [scenarioId, setScenarioId] = useState(microphoneSource.id);
  const [active, setActive] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const scenario = sources.find((s) => s.id === scenarioId)!;
  const usingMic = scenario.id === microphoneSource.id;
  // Latest assessment from the Rust backend, tagged with how many transcript
  // lines it covers.
  const [assessment, setAssessment] = useState<{ lineCount: number; value: Classification } | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const appliedSeq = useRef(0);
  const classification = lines.length && assessment ? assessment.value : emptyClassification;
  const analysing = lines.length > 0 && assessment?.lineCount !== lines.length && !backendError;

  // Send the transcript to the backend whenever it changes. Responses can
  // arrive out of order, so only apply one that is newer than what is shown.
  useEffect(() => {
    if (lines.length === 0) return;
    const seq = ++requestSeq.current;
    const lineCount = lines.length;
    classifyTranscript(lines)
      .then((value) => {
        if (seq < appliedSeq.current) return;
        appliedSeq.current = seq;
        setAssessment({ lineCount, value });
        setBackendError(null);
      })
      .catch((err: unknown) => {
        if (seq < appliedSeq.current) return;
        setBackendError(err instanceof Error ? err.message : "Backend unavailable");
      });
  }, [lines]);

  const interim = useSpeechRecognition({
    listening: active && usingMic,
    lang: SPEECH_LANG,
    onFinal: (text) =>
      setLines((prev) => [...prev, { speaker: "Caller", text: text[0].toUpperCase() + text.slice(1) }]),
    onError: setMicError,
  });

  // Stream the scripted transcript one line at a time while the call is live.
  useEffect(() => {
    if (!active || usingMic) return;
    const timer = setInterval(() => {
      setLines((prev) => {
        if (prev.length >= scenario.transcript.length) return prev;
        return [...prev, scenario.transcript[prev.length]];
      });
    }, LINE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, scenario, usingMic]);

  useEffect(() => {
    if (!active || startedAt === null) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [active, startedAt]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines, interim]);

  function startCall() {
    if (usingMic && !isSpeechRecognitionSupported()) {
      setMicError("This browser does not support speech recognition. Use Chrome or Edge.");
      return;
    }
    setMicError(null);
    // Drop any assessment still in flight from the previous call.
    appliedSeq.current = ++requestSeq.current;
    setAssessment(null);
    setBackendError(null);
    setLines(usingMic ? [] : [scenario.transcript[0]]);
    setNotes("");
    setStartedAt(Date.now());
    setElapsed(0);
    setActive(true);
  }

  function endCall() {
    setActive(false);
  }

  async function downloadSummary() {
    setExporting(true);
    try {
      await downloadCallSummary({
        incident: scenario.label,
        location: scenario.location,
        startedAt: startedAt === null ? null : new Date(startedAt),
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-600 text-lg font-bold text-white">+</span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Emergency Call Dashboard</h1>
            <p className="text-xs text-slate-500">Dispatcher console</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            disabled={active}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            aria-label="Call source"
          >
            <option value={microphoneSource.id}>Live call: microphone</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                Simulate: {s.label}
              </option>
            ))}
          </select>
          {active ? (
            <button
              onClick={endCall}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              End call
            </button>
          ) : (
            <button
              onClick={startCall}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              Answer call
            </button>
          )}
        </div>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-3 lg:p-6">
        {/* Segment 1: assessment of the current call */}
        <section className="flex flex-col gap-4 lg:col-span-1">
          <Panel
            title="Live assessment"
            subtitle={analysing ? "Analysing…" : active ? "Updating from transcript" : "Waiting for call"}
          >
            {backendError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                Assessment backend unreachable ({backendError}). Start it with <code>cargo run</code> in backend/.
              </p>
            )}
            <UrgencyMeter classification={classification} />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <AmbulanceTile ambulance={classification.ambulance} hasData={lines.length > 0} />
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
              <Stat label="Call duration" value={lines.length ? formatDuration(elapsed) : "—"} />
              <Stat label="Status" value={active ? "In progress" : lines.length ? "Ended" : "Idle"} />
            </div>
          </Panel>
        </section>

        {/* Segment 2: AI transcription */}
        <section className="lg:col-span-1">
          <Panel
            title="AI transcription"
            subtitle={active ? `Live · ${formatDuration(elapsed)}` : lines.length ? "Call ended" : "Idle"}
            live={active}
            className="h-full"
          >
            <div className="h-[32rem] overflow-y-auto pr-1 lg:h-[calc(100vh-14rem)]">
              {micError && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{micError}</p>
              )}
              {lines.length === 0 && !interim ? (
                <p className="mt-10 text-center text-sm text-slate-400">
                  {active && usingMic ? (
                    "Listening… start speaking."
                  ) : (
                    <>
                      Press <span className="font-semibold text-slate-600">Answer call</span> to start transcribing
                      {usingMic && " from your microphone"}.
                    </>
                  )}
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {lines.map((line, i) => (
                    <li key={i} className={line.speaker === "Caller" ? "pr-6" : "pl-6"}>
                      <div
                        className={`rounded-lg px-3 py-2 text-sm ${
                          line.speaker === "Caller" ? "bg-slate-100" : "bg-sky-50 text-sky-900"
                        }`}
                      >
                        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {line.speaker}
                        </span>
                        {line.text}
                      </div>
                    </li>
                  ))}
                  {interim && (
                    <li className="pr-6">
                      <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm italic text-slate-500">
                        {interim}…
                      </div>
                    </li>
                  )}
                  {active && (usingMic ? !interim : lines.length < scenario.transcript.length) && (
                    <li className="flex gap-1 px-3 text-slate-400" aria-label="Transcribing">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse [animation-delay:150ms]">●</span>
                      <span className="animate-pulse [animation-delay:300ms]">●</span>
                    </li>
                  )}
                </ol>
              )}
              <div ref={transcriptEnd} />
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
              className="h-[32rem] w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none lg:h-[calc(100vh-15.5rem)]"
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
    </div>

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
            {live && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />}
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

function AmbulanceTile({ ambulance, hasData }: { ambulance: boolean; hasData: boolean }) {
  return (
    <div
      className={`rounded-lg p-3 ring-1 ${
        !hasData
          ? "bg-slate-50 ring-slate-200"
          : ambulance
            ? "bg-red-50 ring-red-500/40"
            : "bg-emerald-50 ring-emerald-500/30"
      }`}
    >
      <span className="text-xs text-slate-500">Ambulance</span>
      <p
        className={`text-xl font-bold ${
          !hasData ? "text-slate-400" : ambulance ? "text-red-700" : "text-emerald-700"
        }`}
      >
        {!hasData ? "—" : ambulance ? "Yes" : "No"}
      </p>
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
        <span className="text-sky-600">Physical {physical}%</span>
        <span className="text-violet-600">Mental {mental}%</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-sky-500 transition-all duration-500" style={{ width: `${physical}%` }} />
        <div className="bg-violet-500 transition-all duration-500" style={{ width: `${mental}%` }} />
      </div>
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
