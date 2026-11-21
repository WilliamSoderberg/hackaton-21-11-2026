import { type CrewIncident, type Incident, type RedFlag, estimateMinutes } from "./crew";

// Deterministic triage for the crew overview, computed from the crew_briefing
// and gold-label data. It always works offline; when Claude is available
// (app/lib/crewAi.ts) its reason and supply split replace the text parts, but
// the ranking itself stays rule-based so it is predictable and explainable.

// Time-critical categories first: minutes decide the outcome there.
const CATEGORY_PRIORITY: Record<string, number> = {
  unconscious_cardiac_arrest: 0,
  allergic_reaction: 1,
  stroke: 2,
  chest_pain: 3,
  breathing_difficulty: 4,
  traffic_trauma: 5,
  seizure: 6,
  mental_health_suicide: 7,
};

const DISPATCH_ORDER = { dispatched: 0, pending: 1, none: 2 };

// Most critical first: urgency A-E, ambulance sent before pending/advice,
// time-critical category, then the longest wait.
export function rankIncidents(incidents: Incident[]): Incident[] {
  return [...incidents].sort(
    (a, b) =>
      a.urgency.localeCompare(b.urgency) ||
      DISPATCH_ORDER[a.dispatch] - DISPATCH_ORDER[b.dispatch] ||
      (CATEGORY_PRIORITY[a.category] ?? 9) - (CATEGORY_PRIORITY[b.category] ?? 9) ||
      b.minutes_since_call - a.minutes_since_call,
  );
}

export function etaMinutes(incident: CrewIncident) {
  return Math.max(1, Math.round(estimateMinutes(incident.ambulance_position, incident.scene, incident.lights_and_sirens)));
}

// The red flag that raised the call to its final urgency: the last flag
// spoken at or before the moment the gold urgency timeline reached it.
export function triggerFlag(incident: Incident): RedFlag | undefined {
  for (const call of incident.calls) {
    const step = call.urgency_timeline.find((s) => s.urgency === incident.urgency);
    if (!step) continue;
    const flags = incident.red_flags.filter((f) => f.call_id === call.call_id);
    const before = flags.filter((f) => f.t <= step.t);
    const flag = before.at(-1) ?? flags[0];
    if (flag) return flag;
  }
  return incident.red_flags[0];
}

const SUSPECTED: Record<string, string> = {
  unconscious_cardiac_arrest: "Suspected cardiac arrest",
  allergic_reaction: "Suspected anaphylaxis",
  stroke: "Suspected stroke",
  chest_pain: "Suspected heart attack",
  breathing_difficulty: "Severe breathing difficulty",
  traffic_trauma: "Trauma",
  seizure: "Seizure",
  mental_health_suicide: "Suicide risk",
};

// One line: what it probably is and the two strongest findings.
export function ruleReason(incident: Incident): string {
  const lead = triggerFlag(incident);
  const labels = [lead, ...incident.red_flags.filter((f) => f !== lead)]
    .filter((f): f is RedFlag => !!f)
    .map((f) => f.label)
    .slice(0, 2);
  const what = incident.urgency <= "B" ? SUSPECTED[incident.category] : incident.category_name;
  return [what ?? incident.category_name, ...labels].join(", ");
}

// Supplies that treat the immediate threat for each category; anything else,
// or anything conditional ("if available", "per protocol"), is "possibly needed".
const CRITICAL_SUPPLIES: Record<string, RegExp> = {
  unconscious_cardiac_arrest: /defib|aed|adrenaline|bag-valve|airway|mechanical cpr|naloxone/i,
  allergic_reaction: /adrenaline|epinephrine|airway|oxygen/i,
  stroke: /glucometer|stroke scale/i,
  chest_pain: /ecg|defib|aed|aspirin/i,
  breathing_difficulty: /oxygen|nebuli|salbutamol/i,
  traffic_trauma: /collar|haemostatic|tourniquet|mattress|board|oxygen/i,
  seizure: /midazolam|benzodiazepine|suction|glucometer/i,
  mental_health_suicide: /naloxone|ecg|charcoal/i,
};
const CONDITIONAL = /\bif\b|per protocol|optional/i;

export type SupplySplit = { critical: string[]; possible: string[] };

export function ruleSupplies(incident: Incident): SupplySplit {
  const critical: string[] = [];
  const possible: string[] = [];
  const match = CRITICAL_SUPPLIES[incident.category];
  const secondDose = incident.prepare_en_route.some((p) => /second dose/i.test(p));
  for (const item of incident.bring) {
    const isCritical = incident.urgency <= "B" && !!match?.test(item) && !CONDITIONAL.test(item);
    const label = secondDose && /adrenaline|epinephrine/i.test(item) ? `${item} ×2` : item;
    (isCritical ? critical : possible).push(label);
  }
  return { critical, possible };
}

// Checklist before arrival: the briefing's en-route tasks plus the pre-alert.
export function prepareChecklist(incident: CrewIncident): string[] {
  return [...incident.prepare_en_route, `Pre-alert ${incident.pre_alert} at ${incident.destination_hospital.name}`];
}
