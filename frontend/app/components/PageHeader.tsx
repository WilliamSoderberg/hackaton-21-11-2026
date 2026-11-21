import type { ReactNode } from "react";
import AppNav from "./AppNav";

// One header for every page: logo, title + subtitle, main nav, and page-specific controls on the right.
export default function PageHeader({
  title,
  subtitle,
  nav = true,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  nav?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-800 text-lg font-semibold text-white">+</span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {nav && <AppNav />}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">{children}</div>}
    </header>
  );
}

// Pill-style switch shared by the nav and the in-header toggles.
export const segmentedGroup = "flex rounded-md bg-slate-100 p-0.5 text-sm font-medium ring-1 ring-slate-200";
export function segmentedItem(selected: boolean) {
  return `rounded px-3 py-1.5 ${selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={segmentedGroup}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={segmentedItem(value === v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
