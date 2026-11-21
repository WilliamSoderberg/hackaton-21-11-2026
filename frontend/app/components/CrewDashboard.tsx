"use client";

import dynamic from "next/dynamic";
import { type CrewUrgencies, urgencyBands } from "../lib/modelUrgency";
import AppNav from "./AppNav";

// Leaflet needs `window`, so the map is only rendered in the browser.
const CrewMap = dynamic(() => import("./CrewMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-slate-400">Loading map…</div>,
});

export default function CrewDashboard({ urgencies }: { urgencies: CrewUrgencies }) {
  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-600 text-lg font-bold text-white">+</span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Ambulance crew</h1>
            <p className="text-xs text-slate-500">{"Colour = urgency ("}
              {urgencies.source === "keyword" ? "keyword model" : "data labels, backend offline"}
              {") · number = % chance an ambulance is needed (trained model) · hover for details"}</p>
          </div>
          <AppNav />
        </div>
        <Legend />
      </header>
      <main className="min-h-0 flex-1">
        <CrewMap urgencies={urgencies} />
      </main>
    </div>
  );
}

function Legend() {
  const items = [
    ...urgencyBands.map((b) => [b.hex, b.label]),
    ["#3f6185", "Hospital"],
  ];
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-slate-500">
      {items.map(([color, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {label}
        </li>
      ))}
    </ul>
  );
}
