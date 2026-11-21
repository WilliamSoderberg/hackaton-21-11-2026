import type { Urgency } from "./calls";
import type { UrgencyLevel } from "./crew";

// Urgency on the crew map comes from the Rust keyword model
// (backend/src/keyword.rs, POST /api/triage/keyword). The pin number is the
// trained ambulance model's % chance an ambulance is needed (lib/ambulanceModel.ts).
export type KeywordUrgency = { urgency: Urgency; urgencyScore: number };

// Per incident id; `source` says whether the backend answered or we fell back
// to the incident's gold urgency label.
export type CrewUrgencies = { byIncident: Record<string, KeywordUrgency>; source: "keyword" | "fallback" };

export type UrgencyBand = { label: Urgency; hex: string; bg: string };

export const urgencyBands: UrgencyBand[] = [
  { label: "Critical", hex: "#dc2626", bg: "bg-red-700" },
  { label: "High", hex: "#f97316", bg: "bg-orange-600" },
  { label: "Medium", hex: "#f59e0b", bg: "bg-amber-500" },
  { label: "Low", hex: "#10b981", bg: "bg-emerald-600" },
];

export function urgencyBand(urgency: Urgency): UrgencyBand {
  return urgencyBands.find((b) => b.label === urgency) ?? urgencyBands[urgencyBands.length - 1];
}

// Used only if the backend is unreachable: the gold A-E label from the data.
const GOLD: Record<UrgencyLevel, KeywordUrgency> = {
  A: { urgency: "Critical", urgencyScore: 90 },
  B: { urgency: "High", urgencyScore: 60 },
  C: { urgency: "Medium", urgencyScore: 30 },
  D: { urgency: "Low", urgencyScore: 10 },
  E: { urgency: "Low", urgencyScore: 5 },
};

export function goldUrgency(level: UrgencyLevel): KeywordUrgency {
  return GOLD[level];
}
