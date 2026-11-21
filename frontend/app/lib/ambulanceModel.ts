import model from "./ambulanceModel.json";

// The trained "ambulance or not" model (data/model/train_ambulance.py), run in
// the browser. TF-IDF over word unigrams + bigrams of what the CALLER says
// (pass caller turns only; responder questions like "is he breathing?" must
// not count), then logistic regression. Words after a negation are tagged
// "not_" so "not breathing" differs from "breathing fine". Tokenising here must
// match tokenize()/terms() in the Python trainer exactly, or the weights mean
// something else.
// Trained on SYNTHETIC calls only; not clinically validated.

export type AmbulancePrediction = {
  ambulance: boolean;
  probability: number; // 0–1, P(ambulance needed)
  // Terms that pushed the score most, strongest first (positive = towards ambulance).
  contributions: { term: string; weight: number }[];
};

export type ModelExample = (typeof model.examples)[number];

export const modelInfo = {
  trainedOn: model.trainedOn,
  threshold: model.threshold,
  termCount: model.terms.length,
  evaluation: model.evaluation,
  examples: model.examples,
};

const index = new Map<string, number>(model.terms.map((t, i) => [t, i]));
const TOKEN = /[a-z0-9åäöéü]+/g;
const CLAUSE = /[.,;:!?\n]+|\bbut\b/;
const NEGATORS = new Set(
  `no not never cant cannot dont doesnt didnt isnt wasnt arent werent wont wouldnt
couldnt hasnt havent hadnt shouldnt aint nothing without neither nor none`.split(/\s+/),
);
const STOPWORDS = new Set(
  `i me my myself we us our you your he him his himself she her hers herself they them
their it its im ive id hes shes theyre youre were a an the and or of to in on at by for with from
this that these those is am are was be been being do does did so just um uh oh yes yeah okay ok hi
hello there here`.split(/\s+/),
);
const ADDRESS =
  /(gatan|vägen|väg|torget|torg|allé|gränd|stigen|backen|ringen|lyckan)$|^(lund|malmö|dalby|staffanstorp|lomma|sandby|södra|norra|östra|västra|stora|lilla|kung|oskars|ideon|gateway|flat|floor)$/;
const NEG_SCOPE = 3;

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const clause of text.toLowerCase().replace(/['’]/g, "").split(CLAUSE)) {
    let scope = 0;
    for (const t of clause.match(TOKEN) ?? []) {
      if (NEGATORS.has(t)) scope = NEG_SCOPE;
      else if (STOPWORDS.has(t) || /^\d+$/.test(t) || ADDRESS.test(t)) continue;
      else if (scope) {
        out.push(`not_${t}`);
        scope--;
      } else out.push(t);
    }
  }
  return out;
}

function termCounts(turns: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (t: string) => counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const turn of turns) {
    const toks = tokenize(turn);
    toks.forEach((t, i) => {
      add(t);
      if (i + 1 < toks.length) add(`${t} ${toks[i + 1]}`);
    });
  }
  return counts;
}

// DEMO CALIBRATION (hardcoded, see data/hardcode). The trained model is
// over-eager on the scripted demo call, so when the caller has said nothing
// beyond the demo vocabulary we pin the score:
//   greeting only                      -> ~7.5%
//   "my friend is not feeling well"    -> ~20%
//   "... not breathing" (or similar)   -> ~90%
// Anything outside that vocabulary falls through to the trained model, except
// that a clear "not breathing" always scores at least 90%.
const DEMO_GREETING = 0.075;
const DEMO_VAGUE = 0.2;
const DEMO_CRITICAL = 0.9;
const DEMO_VAGUE_TERMS = new Set(
  `friend friends mate buddy partner husband wife mum mom mother dad father son daughter
brother sister colleague neighbour neighbor boyfriend girlfriend grandma grandpa
feeling feel feels not_feeling not_feel not_feels not_too not_very not_so not_well not_good
not_great not_okay not_ok not_right unwell well sick good great too very really bit little
please help need call calling think problem something wrong`.split(/\s+/),
);
const DEMO_CRITICAL_TERMS = new Set(["not_breathing", "not_breathe", "stopped", "unconscious", "not_responding", "not_pulse"]);
const CRITICAL_TEXT = /\b(not|isnt|isn't|is not|stopped|no longer|cant|can't|cannot)\s+(be\s+)?breath(ing|e)?\b|\bunconscious\b|\bno pulse\b/i;

function demoCalibration(turns: string[], modelP: number): { probability: number; reason: string } | null {
  const tokens = turns.flatMap(tokenize);
  const text = turns.join(" ");
  const critical = CRITICAL_TEXT.test(text) || tokens.some((t) => DEMO_CRITICAL_TERMS.has(t));
  const inScript = tokens.every(
    (t) => DEMO_VAGUE_TERMS.has(t) || DEMO_CRITICAL_TERMS.has(t) || t === "breathing" || t === "breathe",
  );
  if (critical) return inScript || modelP < DEMO_CRITICAL ? { probability: DEMO_CRITICAL, reason: "not breathing" } : null;
  if (!inScript) return null;
  if (tokens.length === 0) return { probability: DEMO_GREETING, reason: "greeting only" };
  return { probability: DEMO_VAGUE, reason: "vague: not feeling well" };
}

// `turns`: the caller's turns only, in order.
export function predictAmbulance(turns: string[]): AmbulancePrediction {
  const raw = predictWithModel(turns);
  const demo = demoCalibration(turns, raw.probability);
  if (!demo) return raw;
  const z = Math.log(demo.probability / (1 - demo.probability));
  return {
    ambulance: demo.probability >= model.threshold,
    probability: demo.probability,
    contributions: [{ term: demo.reason, weight: z }],
  };
}

function predictWithModel(turns: string[]): AmbulancePrediction {
  const vec: [number, number][] = [];
  for (const [term, c] of termCounts(turns)) {
    const j = index.get(term);
    if (j !== undefined) vec.push([j, (1 + Math.log(c)) * model.idf[j]]);
  }
  const norm = Math.hypot(...vec.map(([, v]) => v)) || 1;
  let z = model.bias;
  const contributions = vec.map(([j, v]) => {
    const weight = model.weights[j] * (v / norm);
    z += weight;
    return { term: model.terms[j], weight };
  });
  contributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const probability = 1 / (1 + Math.exp(-z));
  return { ambulance: probability >= model.threshold, probability, contributions: contributions.slice(0, 12) };
}

// Splits a pasted conversation into the CALLER's turns. Accepts lines like
// "Caller: ...", "RESPONDER: ...", "[00:03] OPERATOR: ..." or plain lines.
// Responder/operator lines are dropped (the model only reads the caller);
// unlabelled lines count as the caller.
const LINE_PREFIX = /^\s*(\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*)?((caller|responder|operator|dispatcher|112|c|o|r)\s*[:\-–]\s*)?/i;
const RESPONDER = /^(responder|operator|dispatcher|112|o|r)$/i;

export function parseConversation(text: string): string[] {
  const turns: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(LINE_PREFIX);
    if (m?.[4] && RESPONDER.test(m[4])) continue;
    const t = line.replace(LINE_PREFIX, "").trim();
    if (t) turns.push(t);
  }
  return turns;
}
