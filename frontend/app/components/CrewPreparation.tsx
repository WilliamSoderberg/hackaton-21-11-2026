"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { type CrewIncident, crewIncidents, distanceKm, urgencyStyles } from "../lib/crew";
import { rankIncidents } from "../lib/triage";
import { useRoute } from "../lib/useRoute";
import AppNav from "./AppNav";
import { BellIcon, Card, PinIcon, SupplyIcon } from "./crewUi";

// Leaflet needs `window`, so the map is only rendered in the browser.
const CrewMap = dynamic(() => import("./CrewMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-slate-400">Loading map…</div>,
});

// Same order as the overview's priority queue.
const incidents = rankIncidents(crewIncidents) as CrewIncident[];

export default function CrewPreparation({ initialId }: { initialId?: string }) {
  const [incidentId, setIncidentId] = useState(initialId ?? incidents[0].incident_id);
  // Checked "prepare en route" items, kept per incident while switching.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const incident = incidents.find((i) => i.incident_id === incidentId) ?? incidents[0];

  function select(id: string) {
    setIncidentId(id);
    // Keep the address bar on the incident's own URL (/crew/[incidentId])
    // without a navigation, so the checklist state survives.
    window.history.replaceState(null, "", `/crew/${id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-600 text-lg font-bold text-white">+</span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Ambulance Crew Preparation</h1>
            <p className="text-xs text-slate-500">Crew tablet · dispatch briefing</p>
          </div>
          <AppNav />
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {incidents.length} active incidents
          </span>
          <Link
            href="/crew/overview"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            All incidents overview
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:p-6">
        <IncidentList selectedId={incident.incident_id} onSelect={select} />
        <IncidentBriefing
          key={incident.incident_id}
          incident={incident}
          checked={checked}
          onToggle={(item) => setChecked((prev) => ({ ...prev, [item]: !prev[item] }))}
        />
      </div>
    </div>
  );
}

function IncidentList({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Active incidents</h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {incidents.map((i) => {
          const style = urgencyStyles[i.urgency];
          const selected = i.incident_id === selectedId;
          return (
            <li key={i.incident_id} className="w-64 shrink-0 lg:w-auto">
              <button
                onClick={() => onSelect(i.incident_id)}
                aria-pressed={selected}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? "border-slate-900 bg-white shadow-md ring-1 ring-slate-900"
                    : "border-slate-200 bg-white shadow-sm hover:border-slate-400"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg font-bold text-white ${style.bg}`}
                >
                  {i.urgency}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug">{i.category_name}</span>
                  <span className="block truncate text-sm text-slate-500">{i.address}</span>
                  <span className="mt-1 block text-xs font-medium text-slate-400">
                    {i.unit}
                    {i.calls.length > 1 && ` · ${i.calls.length} calls`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function IncidentBriefing({
  incident,
  checked,
  onToggle,
}: {
  incident: CrewIncident;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const route = useRoute(incident);
  const style = urgencyStyles[incident.urgency];
  const eta = Math.max(1, Math.round(route.toScene.minutes));
  const toHospital = Math.max(1, Math.round(route.toHospital.minutes));
  const km = distanceKm(incident.ambulance_position, incident.scene);

  return (
    <main className="flex min-w-0 flex-col gap-4">
      {/* Header: urgency, category, ETA */}
      <section className={`overflow-hidden rounded-xl bg-white shadow-sm ring-1 ${style.ring}`}>
        <div className="flex flex-wrap items-stretch">
          <div className={`flex min-w-36 flex-col items-center justify-center px-6 py-4 text-white ${style.bg}`}>
            <span className="text-xs font-semibold uppercase tracking-widest opacity-90">Urgency</span>
            <span className="text-6xl font-black leading-none">{incident.urgency}</span>
            <span className="mt-1 text-sm font-semibold">{style.label}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-5 py-4">
            <p className={`text-sm font-semibold uppercase tracking-wide ${style.text}`}>{incident.urgency_name}</p>
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{incident.category_name}</h2>
            <p className="text-lg text-slate-600">{incident.title}</p>
            <p className="flex items-center gap-2 text-lg font-medium">
              <PinIcon className="h-5 w-5 shrink-0 text-red-600" />
              {incident.address}
            </p>
          </div>
          <div className="grid w-full grid-cols-3 border-t border-slate-200 sm:w-auto sm:grid-cols-1 sm:border-t-0 sm:border-l">
            <HeaderStat label="ETA to scene" value={`${eta} min`} big />
            <HeaderStat label="Distance" value={`${km.toFixed(1)} km`} />
            <HeaderStat
              label="Response"
              value={incident.lights_and_sirens ? "Lights & sirens" : "No lights"}
              accent={incident.lights_and_sirens ? "text-red-600" : "text-slate-600"}
            />
          </div>
        </div>
        {incident.note && (
          <p className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-base font-medium text-amber-800">
            ⚠ {incident.note}
          </p>
        )}
      </section>

      {/* Map + what to bring + destination */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Card
          title="Route"
          subtitle={`${incident.unit} → scene → ${incident.destination_hospital.name}`}
          className="xl:col-span-3"
          flush
        >
          <div className="h-[22rem] sm:h-[28rem] xl:h-full xl:min-h-[30rem]">
            <CrewMap incident={incident} route={route} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 px-4 py-2.5 text-sm text-slate-600">
            <Legend color="bg-slate-900" label={`Ambulance ${incident.unit}`} />
            <Legend color="bg-red-600" label={`To scene · ${eta} min`} />
            <Legend color="bg-sky-600" label={`To hospital · ${toHospital} min`} />
            <span className="ml-auto text-xs text-slate-400">
              {route.source === "road" ? "Road route (OSRM)" : "Straight-line estimate"} · synthetic positions
            </span>
          </div>
        </Card>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <PackExtra items={incident.bring} />
          <Destination incident={incident} minutes={toHospital} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Checklist incident={incident} checked={checked} onToggle={onToggle} />
        <Resources incident={incident} />
      </div>

      <RedFlags incident={incident} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Key facts" subtitle="From the call">
          <BulletList items={incident.key_facts} />
          <h3 className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Scene notes</h3>
          {incident.scene_notes.length ? (
            <ul className="flex flex-col gap-2">
              {incident.scene_notes.map((note) => (
                <li
                  key={note}
                  className="flex gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-base text-amber-900 ring-1 ring-amber-200"
                >
                  <span aria-hidden>⚠</span>
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-slate-400">None</p>
          )}
        </Card>
        <Card title="Open questions" subtitle="Not answered in the call: check on scene">
          <ul className="flex flex-col gap-2">
            {incident.open_questions.map((q) => (
              <li key={q} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-base ring-1 ring-slate-200">
                <span className="font-bold text-sky-600" aria-hidden>
                  ?
                </span>
                {q}
              </li>
            ))}
          </ul>
          <h3 className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Dispatcher summary</h3>
          {incident.handover.map((h) => (
            <p key={h} className="mb-2 text-base leading-relaxed text-slate-700">
              {h}
            </p>
          ))}
        </Card>
      </div>
    </main>
  );
}

function PackExtra({ items }: { items: string[] }) {
  return (
    <section className="rounded-xl bg-red-600 p-4 text-white shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold uppercase tracking-wide">Pack extra</h2>
        <span className="text-sm text-red-100">{items.length} items</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-base font-semibold text-slate-900">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-red-50 text-red-600">
              <SupplyIcon item={item} />
            </span>
            <span className="first-letter:uppercase">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Destination({ incident, minutes }: { incident: CrewIncident; minutes: number }) {
  const hospital = incident.destination_hospital;
  return (
    <Card title="Destination & pre-alert">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-600 text-xl font-bold text-white">
          H
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold">{hospital.name}</p>
          <p className="text-sm text-slate-500">
            {hospital.detail} · ~{minutes} min from scene
          </p>
        </div>
      </div>
      <p className="mt-3 text-base text-slate-700">{incident.destination}</p>
      <div className="mt-3 flex items-start gap-3 rounded-lg bg-sky-50 px-3 py-2.5 ring-1 ring-sky-200">
        <BellIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-sky-700">Pre-alert</span>
          <p className="text-base font-semibold text-sky-950">{incident.pre_alert}</p>
        </div>
      </div>
    </Card>
  );
}

function Checklist({
  incident,
  checked,
  onToggle,
}: {
  incident: CrewIncident;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const keys = incident.prepare_en_route.map((item) => `${incident.incident_id}::${item}`);
  const done = keys.filter((k) => checked[k]).length;
  return (
    <Card title="Prepare en route" subtitle={`${done}/${keys.length} ready`}>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${(done / keys.length) * 100}%` }}
        />
      </div>
      <ul className="flex flex-col gap-2">
        {incident.prepare_en_route.map((item, i) => {
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
    </Card>
  );
}

// The four extra resources a crew most often has to coordinate with, matched
// from the free-text briefing.
const resourceKinds = [
  { label: "Police", match: /police/i },
  { label: "Rescue service", match: /rescue|first responder/i },
  { label: "Interpreter", match: /interpret/i },
  { label: "Second ambulance", match: /second ambulance|ambulance x2|2nd ambulance/i },
];

function Resources({ incident }: { incident: CrewIncident }) {
  const texts = [...incident.extra_units, incident.crew, ...incident.scene_notes];
  const other = incident.extra_units.filter((u) => !resourceKinds.some((k) => k.match.test(u)));
  return (
    <Card title="Extra resources" subtitle={`Crew: ${incident.crew}`}>
      <ul className="grid grid-cols-2 gap-2">
        {resourceKinds.map((kind) => {
          const reasons = texts.filter((t) => kind.match.test(t));
          const needed = reasons.length > 0;
          return (
            <li
              key={kind.label}
              className={`rounded-lg p-3 ring-1 ${needed ? "bg-red-50 ring-red-500/40" : "bg-slate-50 ring-slate-200"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-base font-semibold ${needed ? "text-slate-900" : "text-slate-400"}`}>
                  {kind.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    needed ? "bg-red-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {needed ? "NEEDED" : "No"}
                </span>
              </div>
              {needed && <p className="mt-1 text-sm text-slate-600">{reasons[0]}</p>}
            </li>
          );
        })}
      </ul>
      {other.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Also involved</h3>
          <ul className="flex flex-wrap gap-2">
            {other.map((u) => (
              <li key={u} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {u}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function RedFlags({ incident }: { incident: CrewIncident }) {
  const multiCall = incident.calls.length > 1;
  return (
    <Card title="Red flags" subtitle="Why this urgency: the exact words from the 112 call">
      <ul className="grid gap-3 md:grid-cols-2">
        {incident.red_flags.map((flag) => (
          <li
            key={`${flag.call_id}-${flag.quote}`}
            className="flex flex-col gap-2 rounded-lg border-l-4 border-red-500 bg-red-50/60 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-bold text-red-700 first-letter:uppercase">{flag.label}</span>
              <span className="shrink-0 rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-500 ring-1 ring-slate-200">
                {flag.time}
              </span>
            </div>
            <blockquote className="text-lg leading-snug text-slate-900">
              <span className="rounded bg-yellow-200/80 px-1 box-decoration-clone">“{flag.quote}”</span>
            </blockquote>
            <span className="text-xs text-slate-500">
              {flag.speaker === "caller" ? "Caller" : "Operator"}
              {multiCall && ` · ${incident.calls.find((c) => c.call_id === flag.call_id)?.title}`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HeaderStat({ label, value, big, accent = "" }: { label: string; value: string; big?: boolean; accent?: string }) {
  return (
    <div className="flex flex-col justify-center px-5 py-3 sm:border-b sm:border-slate-200 sm:last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`font-bold ${big ? "text-3xl" : "text-lg"} ${accent}`}>{value}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2.5 w-5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
          <span className={item.startsWith("UPDATE") ? "font-semibold text-red-700" : ""}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
