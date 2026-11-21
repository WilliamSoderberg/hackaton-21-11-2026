"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type CrewIncident, type Incident, type RedFlag, allIncidents, urgencyStyles } from "../lib/crew";
import { type CrewAnalysis, analyseIncidents } from "../lib/crewAi";
import { etaMinutes, prepareChecklist, rankIncidents, ruleReason, ruleSupplies, triggerFlag } from "../lib/triage";
import AppNav from "./AppNav";
import { Card, PinIcon, SupplyIcon } from "./crewUi";

// Leaflet needs `window`, so the map is only rendered in the browser.
const OverviewMap = dynamic(() => import("./OverviewMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-slate-400">Loading map…</div>,
});

const ranked = rankIncidents(allIncidents);
const withAmbulance = ranked.filter((i): i is CrewIncident => i.dispatch !== "none");
// Claude (or the rules) explain and pack for the first few jobs.
const TOP_COUNT = 3;
const topIds = withAmbulance.slice(0, TOP_COUNT).map((i) => i.incident_id);

type AiState = { status: "loading" } | { status: "done"; analysis: CrewAnalysis | null };

export default function CrewOverview() {
  const [selectedId, setSelectedId] = useState(ranked[0].incident_id);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ai, setAi] = useState<AiState>({ status: "loading" });
  const elapsed = useElapsedMinutes();

  useEffect(() => {
    analyseIncidents(topIds)
      .then((analysis) => setAi({ status: "done", analysis }))
      .catch(() => setAi({ status: "done", analysis: null }));
  }, []);

  const analysis = ai.status === "done" ? ai.analysis : null;
  const explain = useMemo(() => {
    const byId = new Map(analysis?.incidents.map((a) => [a.incident_id, a]));
    return (incident: Incident): Explanation => {
      const a = byId.get(incident.incident_id);
      const quote = a?.trigger_quote && incident.red_flags.find((f) => f.quote === a.trigger_quote);
      const rules = ruleSupplies(incident);
      return {
        reason: a?.reason ?? ruleReason(incident),
        flag: quote || triggerFlag(incident),
        supplies: a && a.critical_supplies.length ? { critical: a.critical_supplies, possible: a.possible_supplies } : rules,
        source: a ? "claude" : "rules",
      };
    };
  }, [analysis]);

  const selected = ranked.find((i) => i.incident_id === selectedId)!;
  const first = ranked[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-600 text-lg font-bold text-white">+</span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Crew Overview</h1>
            <p className="text-xs text-slate-500">All active incidents · most critical first</p>
          </div>
          <AppNav />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {ranked.length} incidents · {withAmbulance.length} with ambulance
          </span>
          <AiBadge ai={ai} />
        </div>
      </header>

      <main className="flex flex-col gap-4 p-4 lg:p-6">
        <GoHereFirst incident={first} explanation={explain(first)} elapsed={elapsed} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <Card
            title="All incidents"
            subtitle="Tap a marker to select · numbers are priority rank"
            flush
          >
            <div className="h-[26rem] sm:h-[34rem] xl:h-[40rem]">
              <OverviewMap ranked={ranked} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <MapLegend />
          </Card>
          <PriorityQueue selectedId={selectedId} onSelect={setSelectedId} elapsed={elapsed} explain={explain} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <PackExtraTop explain={explain} />
          <PrepareChecklist
            incident={selected}
            rank={ranked.indexOf(selected) + 1}
            checked={checked}
            onToggle={(key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))}
          />
        </div>
      </main>
    </div>
  );
}

type Explanation = {
  reason: string;
  flag?: RedFlag;
  supplies: { critical: string[]; possible: string[] };
  source: "claude" | "rules";
};

// Whole minutes since the page opened, added to each incident's synthetic
// minutes_since_call. Starts at 0 on server and client, so no hydration diff.
function useElapsedMinutes() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 60000)), 15000);
    return () => clearInterval(timer);
  }, []);
  return elapsed;
}

function AiBadge({ ai }: { ai: AiState }) {
  const text =
    ai.status === "loading"
      ? "Asking Claude…"
      : ai.analysis
        ? `Claude · ${ai.analysis.model}`
        : "Rules · offline";
  return (
    <span className="flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
      <SparkIcon />
      AI suggestion – crew decides
      <span className="text-violet-400">·</span>
      <span className={ai.status === "loading" ? "animate-pulse" : ""}>{text}</span>
    </span>
  );
}

function GoHereFirst({ incident, explanation, elapsed }: { incident: Incident; explanation: Explanation; elapsed: number }) {
  const style = urgencyStyles[incident.urgency];
  const { flag } = explanation;
  return (
    <section className={`overflow-hidden rounded-xl bg-white shadow-sm ring-2 ${style.ring}`}>
      <div className="flex flex-wrap items-stretch">
        <div className={`flex min-w-40 flex-col items-center justify-center gap-1 px-6 py-5 text-white ${style.bg}`}>
          <span className="text-xs font-semibold uppercase tracking-widest opacity-90">Go here first</span>
          <span className="text-6xl font-black leading-none">#1</span>
          <span className="rounded bg-white/20 px-2 py-0.5 text-sm font-bold">
            {incident.urgency} · {style.label}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{incident.category_name}</h2>
            <SourceTag source={explanation.source} />
          </div>
          <p className={`text-lg font-semibold ${style.text}`}>
            {explanation.reason} · {incident.minutes_since_call + elapsed} min since call
          </p>
          <p className="flex items-center gap-2 text-lg font-medium">
            <PinIcon className="h-5 w-5 shrink-0 text-red-600" />
            {incident.address}
          </p>
          {flag && (
            <blockquote className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-4 border-red-500 pl-3">
              <span className="rounded bg-yellow-200/80 px-1 text-xl leading-snug box-decoration-clone">“{flag.quote}”</span>
              <span className="text-sm text-slate-500">
                {flag.speaker === "caller" ? "Caller" : "Operator"} at {flag.time} · {flag.label}
              </span>
            </blockquote>
          )}
        </div>
        <div className="flex w-full flex-col justify-center gap-3 border-t border-slate-200 px-5 py-4 sm:w-auto sm:min-w-56 sm:border-t-0 sm:border-l">
          {incident.dispatch === "none" ? (
            <p className="text-base text-slate-500">No ambulance sent</p>
          ) : (
            <>
              <div>
                <span className="text-xs text-slate-500">{incident.unit} · ETA</span>
                <p className="text-3xl font-bold">{etaMinutes(incident)} min</p>
              </div>
              <Link
                href={`/crew/${incident.incident_id}`}
                className="rounded-md bg-red-600 px-4 py-2.5 text-center text-base font-semibold text-white hover:bg-red-500"
              >
                Open briefing →
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function PriorityQueue({
  selectedId,
  onSelect,
  elapsed,
  explain,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  elapsed: number;
  explain: (i: Incident) => Explanation;
}) {
  return (
    <Card title="Priority queue" subtitle="Urgency → time-critical → wait" flush>
      <ol className="flex max-h-[40rem] flex-col gap-2 overflow-y-auto px-4 pb-4 xl:max-h-[42.5rem]">
        {ranked.map((incident, index) => {
          const style = urgencyStyles[incident.urgency];
          const selected = incident.incident_id === selectedId;
          const advice = incident.dispatch === "none";
          return (
            <li key={incident.incident_id}>
              <div
                className={`flex items-stretch overflow-hidden rounded-xl border transition-colors ${
                  selected ? "border-slate-900 bg-white shadow-md ring-1 ring-slate-900" : "border-slate-200 bg-white hover:border-slate-400"
                } ${advice ? "opacity-70" : ""}`}
              >
                <button
                  onClick={() => onSelect(incident.incident_id)}
                  aria-pressed={selected}
                  className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left"
                >
                  <span className="w-6 shrink-0 pt-2 text-right text-sm font-bold text-slate-400">{index + 1}</span>
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg font-bold text-white ${
                      advice ? "bg-slate-400" : style.bg
                    }`}
                  >
                    {incident.urgency}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug">{incident.category_name}</span>
                    <span className="block truncate text-sm text-slate-500">{incident.address}</span>
                    {index < 8 && !advice && (
                      <span className="mt-0.5 block truncate text-xs text-slate-600" title={explain(incident).reason}>
                        {explain(incident).reason}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-x-3 text-xs font-medium text-slate-500">
                      <span>{incident.minutes_since_call + elapsed} min since call</span>
                      {advice ? (
                        <span>Advice only · no ambulance</span>
                      ) : (
                        <span className="text-slate-700">
                          {incident.unit} · ETA {etaMinutes(incident)} min
                          {incident.dispatch === "pending" && " · pending call-back"}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {!advice && (
                  <Link
                    href={`/crew/${incident.incident_id}`}
                    className="grid w-12 shrink-0 place-items-center border-l border-slate-200 text-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                    aria-label={`Open briefing for #${index + 1} ${incident.category_name}`}
                    title="Open briefing"
                  >
                    →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function PackExtraTop({ explain }: { explain: (i: Incident) => Explanation }) {
  return (
    <section className="rounded-xl bg-red-600 p-4 text-white shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold uppercase tracking-wide">Pack extra · top {TOP_COUNT}</h2>
        <span className="text-sm text-red-100">AI suggestion – crew decides</span>
      </div>
      <div className="flex flex-col gap-3">
        {withAmbulance.slice(0, TOP_COUNT).map((incident) => {
          const { supplies, source } = explain(incident);
          return (
            <div key={incident.incident_id} className="rounded-lg bg-white p-3 text-slate-900">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm font-bold text-white ${urgencyStyles[incident.urgency].bg}`}
                  >
                    {ranked.indexOf(incident) + 1}
                  </span>
                  <span className="truncate text-base font-semibold">{incident.category_name}</span>
                </span>
                <SourceTag source={source} />
              </div>
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-red-700">Critical – must bring</h3>
              <SupplyChips items={supplies.critical} strong />
              {supplies.possible.length > 0 && (
                <>
                  <h3 className="mt-3 mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Possibly needed</h3>
                  <SupplyChips items={supplies.possible} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SupplyChips({ items, strong }: { items: string[]; strong?: boolean }) {
  if (!items.length) return <p className="text-sm text-slate-400">Nothing extra</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
            strong ? "bg-red-50 text-red-900 ring-1 ring-red-300" : "bg-slate-100 text-slate-700"
          }`}
        >
          <span className={strong ? "text-red-600" : "text-slate-400"}>
            <SupplyIcon item={item} />
          </span>
          <span className="first-letter:uppercase">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PrepareChecklist({
  incident,
  rank,
  checked,
  onToggle,
}: {
  incident: Incident;
  rank: number;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  if (incident.dispatch === "none") {
    return (
      <Card title="Prepare before arrival" subtitle={`#${rank} ${incident.category_name}`}>
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-base text-slate-500 ring-1 ring-slate-200">
          No ambulance for this call: advice given ({incident.address}).
        </p>
      </Card>
    );
  }
  const items = prepareChecklist(incident);
  const keys = items.map((item) => `${incident.incident_id}::${item}`);
  const done = keys.filter((k) => checked[k]).length;
  return (
    <Card title="Prepare before arrival" subtitle={`#${rank} ${incident.category_name} · ${done}/${keys.length} ready`}>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(done / keys.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => {
          const isChecked = !!checked[keys[i]];
          return (
            <li key={item}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-base ring-1 transition-colors ${
                  isChecked ? "bg-emerald-50 text-slate-500 ring-emerald-200" : "bg-white ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(keys[i])}
                  className="h-6 w-6 shrink-0 accent-emerald-600"
                />
                <span className={`first-letter:uppercase ${isChecked ? "line-through" : "font-medium"}`}>{item}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/crew/${incident.incident_id}`}
        className="mt-4 block rounded-md bg-slate-900 px-4 py-2.5 text-center text-base font-semibold text-white hover:bg-slate-700"
      >
        Open full briefing for #{rank} →
      </Link>
    </Card>
  );
}

function SourceTag({ source }: { source: "claude" | "rules" }) {
  return (
    <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
      {source === "claude" ? "AI suggestion" : "Rule-based suggestion"} – crew decides
    </span>
  );
}

function MapLegend() {
  const levels = (["A", "B", "C", "D"] as const).map((u) => ({ u, ...urgencyStyles[u] }));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 px-4 py-2.5 text-sm text-slate-600">
      {levels.map((l) => (
        <span key={l.u} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-full ${l.bg}`} />
          {l.u} {l.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-slate-400" />
        No ambulance
      </span>
      <span className="flex items-center gap-1.5">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-slate-900 text-[9px] font-bold text-white">A</span>
        Ambulance
      </span>
      <span className="flex items-center gap-1.5">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-sky-600 text-[9px] font-bold text-white">H</span>
        Hospital
      </span>
      <span className="ml-auto text-xs text-slate-400">Synthetic positions</span>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.5L12 16l-1.8-5.5L4.5 9l5.7-1.4L12 2Zm7 12 .9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14Z" />
    </svg>
  );
}
