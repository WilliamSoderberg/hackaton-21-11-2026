"use client";

import type { ReactNode } from "react";

// Building blocks shared by the crew pages (/crew and /crew/overview).

export function Card({
  title,
  subtitle,
  className = "",
  flush,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
        flush ? "" : "p-4"
      } ${className}`}
    >
      <div className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 ${flush ? "px-4 pt-4 pb-3" : "mb-4"}`}>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <span className="text-sm text-slate-500">{subtitle}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

// Icons for the "pack extra" list, picked by keyword.
const supplyIcons: { match: RegExp; path: string }[] = [
  { match: /ecg|defib|aed|cpr|pulse ox/i, path: "M3 12h4l2-5 4 10 2-5h6" },
  {
    match: /adrenaline|epinephrine|midazolam|naloxone|iv |iv$|fluids|syringe|corticosteroid|antihistamine/i,
    path: "m18 2 4 4m-5 1 3-3M19 9 8.7 19.3a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 0 1 0-1.4L15 5m-6 6 4 4m-10 6 3-3",
  },
  { match: /oxygen|nebuli|cpap|airway|bag-valve|suction/i, path: "M12 3v6m0 0c-3 0-7 3-7 8a3 3 0 0 0 6 0V9m1 0c3 0 7 3 7 8a3 3 0 0 1-6 0V9" },
  { match: /glucometer|thermometer/i, path: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" },
  { match: /aspirin|nitro|charcoal|pill/i, path: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Zm-2-12 7 7" },
  {
    match: /collar|mattress|board|binder|dressing|tourniquet/i,
    path: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  },
  { match: /police|pre-alert/i, path: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0" },
  { match: /card|scale|paediatric|kit/i, path: "M9 3h6v4H9zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M9 12h6m-6 4h4" },
];

export function SupplyIcon({ item }: { item: string }) {
  const path = supplyIcons.find((i) => i.match.test(item))?.path ?? "M21 8 12 3 3 8v8l9 5 9-5V8Zm-18 0 9 5 9-5m-9 5v8";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
