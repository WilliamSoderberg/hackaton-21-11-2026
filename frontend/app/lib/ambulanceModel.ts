import model from "./ambulanceModel.json";

// The trained "ambulance or not" model (data/model/train_ambulance.py), run in
// the browser. TF-IDF over word unigrams + bigrams of the whole conversation,
// then logistic regression. Tokenising here must match tokenize()/terms() in
// the Python trainer exactly, or the weights mean something else.
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

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/['’]/g, "").match(TOKEN) ?? [];
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

export function predictAmbulance(turns: string[]): AmbulancePrediction {
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

// Splits a pasted conversation into turns. Accepts lines like
// "Caller: ...", "RESPONDER: ...", "[00:03] OPERATOR: ..." or plain lines;
// timestamps and speaker labels are dropped, since the model reads the text.
const LINE_PREFIX = /^\s*(\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*)?((caller|responder|operator|dispatcher|112|c|o|r)\s*[:\-–]\s*)?/i;

export function parseConversation(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .map((line) => line.replace(LINE_PREFIX, "").trim())
    .filter(Boolean);
}
