import { predictAmbulance } from "./ambulanceModel";
import type { Incident, RedFlag } from "./crew";

// Triage for the crew map: ambulance % from the trained ambulance model,
// supplies and the key quote from rules over the crew_briefing data. Urgency
// comes from the Rust keyword model (lib/crewUrgency.ts).

// Model probability that the incident needs an ambulance: the highest over
// its calls (an incident can have several callers).
export function ambulanceProbability(incident: Incident): number {
  return Math.max(...incident.calls.map((c) => predictAmbulance(c.turns).probability));
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
