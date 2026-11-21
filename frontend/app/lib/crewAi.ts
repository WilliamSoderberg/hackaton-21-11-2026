"use server";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { type Incident, allIncidents } from "./crew";

// Server Action: asks Claude why each of the top incidents is critical and
// what the crew must bring. Runs on the Next.js server, so the API key never
// reaches the browser. Returns null when no key is configured or the call
// fails - the overview then keeps its rule-based text (app/lib/triage.ts).
// The ranking itself is not delegated to the model.

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

const AnalysisSchema = z.object({
  incidents: z.array(
    z.object({
      incident_id: z.string(),
      reason: z.string().describe("One line, max ~90 characters, why this incident is critical. No time since call."),
      trigger_quote: z.string().describe("The single red-flag quote, copied exactly, that best justifies the urgency."),
      critical_supplies: z.array(z.string()).describe("Must bring for the immediate threat, e.g. 'adrenaline (EpiPen) ×2'."),
      possible_supplies: z.array(z.string()).describe("Possibly needed, depending on findings on scene."),
    }),
  ),
});

export type IncidentAnalysis = z.infer<typeof AnalysisSchema>["incidents"][number];
export type CrewAnalysis = { model: string; incidents: IncidentAnalysis[] };

const SYSTEM = `You support Swedish ambulance crews in the Lund area (Region Skåne) on their way to 112 calls.
For each incident you get the dispatch briefing and the red flags heard in the call, each with the caller's exact words.
Write, per incident:
- reason: one short line a paramedic can read at a glance, naming the suspected condition and the strongest findings.
- trigger_quote: the one red-flag quote that best justifies the urgency, copied character for character from the given red flags.
- critical_supplies / possible_supplies: split the crew's supplies into what they must bring for the immediate threat and what may be needed. Keep each item short; add a count when a second dose may be needed.
Use only the facts given. You make suggestions; the crew decides.`;

function briefing(i: Incident) {
  return {
    incident_id: i.incident_id,
    category: i.category_name,
    urgency: `${i.urgency} (${i.urgency_name})`,
    key_facts: i.key_facts,
    scene_notes: i.scene_notes,
    red_flags: i.red_flags.map((f) => ({ label: f.label, quote: f.quote })),
    bring: i.bring,
    prepare_en_route: i.prepare_en_route,
  };
}

// Same request within the TTL (page reloads in a demo) reuses the answer.
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; result: Promise<CrewAnalysis | null> }>();

export async function analyseIncidents(incidentIds: string[]): Promise<CrewAnalysis | null> {
  // No credentials: stay offline instead of waiting for a failed request.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  const incidents = incidentIds
    .map((id) => allIncidents.find((i) => i.incident_id === id))
    .filter((i): i is Incident => !!i);
  if (incidents.length === 0) return null;

  const key = incidents.map((i) => i.incident_id).join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  const result = requestAnalysis(incidents).catch((err: unknown) => {
    console.error("Crew AI analysis failed:", err instanceof Error ? err.message : err);
    cache.delete(key);
    return null;
  });
  cache.set(key, { at: Date.now(), result });
  return result;
}

async function requestAnalysis(incidents: Incident[]): Promise<CrewAnalysis | null> {
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // Short per-incident text: low effort keeps the demo responsive.
    output_config: { effort: "low", format: betaZodOutputFormat(AnalysisSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify({ incidents: incidents.map(briefing) }, null, 2) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    console.error("Crew AI analysis: no usable output, stop_reason", response.stop_reason);
    return null;
  }

  // Keep only answers for the incidents we asked about; a quote that is not
  // verbatim in the call is dropped so the page falls back to the rule's quote.
  const byId = new Map(incidents.map((i) => [i.incident_id, i]));
  const checked = response.parsed_output.incidents.flatMap((a) => {
    const incident = byId.get(a.incident_id);
    if (!incident || !a.reason.trim()) return [];
    const quoteOk = incident.red_flags.some((f) => f.quote === a.trigger_quote);
    return [{ ...a, trigger_quote: quoteOk ? a.trigger_quote : "" }];
  });
  return { model: response.model, incidents: checked };
}
