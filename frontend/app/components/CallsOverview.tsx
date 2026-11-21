"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { CallRecord, Urgency } from "../lib/calls";
import AppNav from "./AppNav";

// Table of the calls in the backend's SQLite call log, refreshed every few
// seconds. Sorting happens here; the backend returns newest first.

const POLL_MS = 3000;

type SortKey = "urgency" | "ambulance" | "started";
type Sort = { key: SortKey; dir: "asc" | "desc" };
type Filter = "active" | "all";

const urgencyRank: Record<Urgency, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

const urgencyBadge: Record<Urgency, string> = {
  Low: "bg-slate-50 text-emerald-800 ring-slate-300",
  Medium: "bg-slate-50 text-amber-800 ring-slate-300",
  High: "bg-orange-50/60 text-orange-800 ring-orange-800/20",
  Critical: "bg-red-50/60 text-red-800 ring-red-800/20",
};

// Not yet assessed sorts below Low; unknown ambulance sorts below "No".
function sortValue(call: CallRecord, key: SortKey): number {
  switch (key) {
    case "urgency":
      return call.urgency ? urgencyRank[call.urgency] * 1000 + (call.urgencyScore ?? 0) : -1;
    case "ambulance":
      return call.ambulance === null ? -1 : call.ambulance ? 1 : 0;
    case "started":
      return call.startedAt;
  }
}

function sortCalls(calls: CallRecord[], sort: Sort): CallRecord[] {
  const sign = sort.dir === "desc" ? -1 : 1;
  return [...calls].sort(
    (a, b) =>
      sign * (sortValue(a, sort.key) - sortValue(b, sort.key)) ||
      // Ties: most urgent, then newest first.
      sortValue(b, "urgency") - sortValue(a, "urgency") ||
      b.startedAt - a.startedAt,
  );
}

function useCalls(filter: Filter) {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/calls${filter === "active" ? "?status=active" : ""}`, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 502 ? "Backend unavailable" : `Request failed (${res.status})`);
        const data: CallRecord[] = await res.json();
        if (cancelled) return;
        setCalls(data);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load calls");
      }
      if (!cancelled) setNow(Date.now());
    };
    void load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [filter]);

  return { calls, error, now };
}

export default function CallsOverview() {
  const [filter, setFilter] = useState<Filter>("active");
  const [sort, setSort] = useState<Sort>({ key: "urgency", dir: "desc" });
  const [expanded, setExpanded] = useState<number | null>(null);
  const { calls, error, now } = useCalls(filter);
  const rows = useMemo(() => (calls ? sortCalls(calls, sort) : []), [calls, sort]);
  const activeCount = calls?.filter((c) => c.status === "active").length ?? 0;
  const ambulanceCount = calls?.filter((c) => c.status === "active" && c.ambulance).length ?? 0;

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-800 text-lg font-semibold text-white">+</span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Ongoing Calls</h1>
            <p className="text-xs text-slate-500">Call log · updates every {POLL_MS / 1000} s</p>
          </div>
          <AppNav />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${activeCount ? "animate-pulse bg-red-700" : "bg-slate-300"}`} />
            {activeCount} ongoing
          </span>
          <span>{ambulanceCount} need an ambulance</span>
          <div role="radiogroup" aria-label="Show" className="flex rounded-md bg-slate-100 p-0.5 ring-1 ring-slate-200">
            {(
              [
                ["active", "Ongoing"],
                ["all", "All calls"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded px-3 py-1.5 font-medium ${
                  filter === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-4 lg:p-6">
        {error && (
          <p className="mb-3 rounded-lg bg-red-50/60 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
            {error}
            {calls && " · showing the last loaded list"}
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Incident</th>
                <SortHeader label="Urgency" sortKey="urgency" sort={sort} onSort={toggleSort} />
                <SortHeader label="Ambulance" sortKey="ambulance" sort={sort} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium">Indicators</th>
                <SortHeader label="Started" sortKey="started" sort={sort} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!calls && !error && <EmptyRow text="Loading calls…" />}
              {calls && rows.length === 0 && (
                <EmptyRow
                  text={
                    filter === "active"
                      ? "No ongoing calls. Answer a call on the Dispatcher page and it shows up here."
                      : "No calls recorded yet."
                  }
                />
              )}
              {rows.map((call) => (
                <Fragment key={call.id}>
                  <CallRow
                    call={call}
                    now={now}
                    expanded={expanded === call.id}
                    onToggle={() => setExpanded((id) => (id === call.id ? null : call.id))}
                  />
                  {expanded === call.id && <TranscriptRow call={call} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-4 py-3 font-medium" aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900 ${
          active ? "text-slate-900" : ""
        }`}
      >
        {label}
        <span aria-hidden className={active ? "" : "text-slate-300"}>
          {active && sort.dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function CallRow({
  call,
  now,
  expanded,
  onToggle,
}: {
  call: CallRecord;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const active = call.status === "active";
  return (
    <tr
      onClick={onToggle}
      aria-expanded={expanded}
      className={`cursor-pointer align-top hover:bg-slate-50 ${expanded ? "bg-slate-50" : ""} ${
        active ? "" : "text-slate-500"
      }`}
    >
      <td className="px-4 py-3 font-mono text-xs text-slate-400">{call.id}</td>
      <td className="px-4 py-3">
        <span className="block font-medium text-slate-900">{call.label}</span>
        <span className="block text-xs text-slate-500">{call.location}</span>
      </td>
      <td className="px-4 py-3">
        {call.urgency ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${urgencyBadge[call.urgency]}`}
          >
            {call.urgency}
            <span className="font-normal opacity-70">{call.urgencyScore}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400">Not assessed</span>
        )}
      </td>
      <td className="px-4 py-3">
        {call.ambulance === null ? (
          <span className="text-xs text-slate-400">—</span>
        ) : call.ambulance ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-700" />
            Yes
          </span>
        ) : (
          <span className="text-slate-500">No</span>
        )}
      </td>
      <td className="max-w-xs px-4 py-3">
        {call.indicators.length ? (
          <span className="flex flex-wrap gap-1">
            {call.indicators.slice(0, 4).map((i) => (
              <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                {i}
              </span>
            ))}
            {call.indicators.length > 4 && (
              <span className="px-1 text-xs text-slate-400">+{call.indicators.length - 4}</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="block">{formatTime(call.startedAt)}</span>
        <span className="block text-xs text-slate-500">
          {formatDuration((call.endedAt ?? (now || call.updatedAt)) - call.startedAt)}
        </span>
      </td>
      <td className="px-4 py-3">
        {active ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            In progress
          </span>
        ) : (
          "Ended"
        )}
      </td>
    </tr>
  );
}

function TranscriptRow({ call }: { call: CallRecord }) {
  return (
    <tr className="bg-slate-50">
      <td />
      <td colSpan={6} className="px-4 pb-4">
        {call.transcript.length ? (
          <ol className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
            {call.transcript.map((line, i) => (
              <li key={i}>
                <span className={`font-medium ${line.speaker === "Caller" ? "text-slate-900" : "text-slate-500"}`}>
                  {line.speaker === "Caller" ? "Caller" : "Responder"}:
                </span>{" "}
                {line.text}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-400">No transcript yet.</p>
        )}
      </td>
    </tr>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
        {text}
      </td>
    </tr>
  );
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
