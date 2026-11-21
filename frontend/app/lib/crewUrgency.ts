import { allIncidents } from "./crew";
import { type CrewUrgencies, type KeywordUrgency, goldUrgency } from "./modelUrgency";

// Server-only: rates every crew-map incident with the Rust keyword model.
// An incident's urgency is the highest over its calls (several callers).
// Falls back to the gold labels if the backend is unreachable.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function crewUrgencies(): Promise<CrewUrgencies> {
  const calls = allIncidents.flatMap((incident) => incident.calls.map((call) => ({ incident, call })));
  try {
    const res = await fetch(`${BACKEND_URL}/api/triage/keyword`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcripts: calls.map(({ call }) => call.turns.map((text) => ({ speaker: "Caller", text }))),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const results: KeywordUrgency[] = await res.json();
    const byIncident: Record<string, KeywordUrgency> = {};
    calls.forEach(({ incident }, i) => {
      const prev = byIncident[incident.incident_id];
      if (!prev || results[i].urgencyScore > prev.urgencyScore) byIncident[incident.incident_id] = results[i];
    });
    return { byIncident, source: "keyword" };
  } catch (err) {
    console.error("Keyword triage failed, using gold urgency labels:", err);
    return {
      byIncident: Object.fromEntries(allIncidents.map((i) => [i.incident_id, goldUrgency(i.urgency)])),
      source: "fallback",
    };
  }
}
