export type Speaker = "Caller" | "Operator";

export type TranscriptLine = {
  speaker: Speaker;
  text: string;
};

export type Urgency = "Low" | "Medium" | "High" | "Critical";

export type Classification = {
  urgency: Urgency;
  urgencyScore: number; // 0–100
  ambulance: boolean;
  physical: number; // 0–100, share of physical indicators
  mental: number; // 0–100, share of mental indicators
  indicators: string[];
};

export type Scenario = {
  id: string;
  label: string;
  location: string;
  transcript: TranscriptLine[];
};

// Scripted calls used to simulate the AI transcriber until a real
// speech-to-text source is connected.
export const scenarios: Scenario[] = [
  {
    id: "cardiac",
    label: "Collapsed person",
    location: "Storgatan 12, apt 4B",
    transcript: [
      { speaker: "Operator", text: "Emergency services, what is your emergency?" },
      { speaker: "Caller", text: "My father just collapsed in the kitchen, he's not responding!" },
      { speaker: "Operator", text: "Okay, stay with me. Is he breathing?" },
      { speaker: "Caller", text: "I don't think so, he's not breathing and his lips are turning blue." },
      { speaker: "Operator", text: "What is the address where you are?" },
      { speaker: "Caller", text: "Storgatan 12, apartment 4B." },
      { speaker: "Operator", text: "Help is on the way. Has he complained about anything earlier today?" },
      { speaker: "Caller", text: "He said he had chest pain this morning but thought it was nothing." },
      { speaker: "Operator", text: "I'm going to guide you through CPR. Put him flat on his back." },
      { speaker: "Caller", text: "Okay, he's on his back. He's still unconscious." },
      { speaker: "Operator", text: "Place your hands in the centre of his chest and push hard and fast." },
    ],
  },
  {
    id: "mental",
    label: "Person in crisis",
    location: "Unknown — caller on mobile",
    transcript: [
      { speaker: "Operator", text: "Emergency services, what is your emergency?" },
      { speaker: "Caller", text: "I don't really know why I'm calling. I just can't do this anymore." },
      { speaker: "Operator", text: "I'm glad you called. Can you tell me your name?" },
      { speaker: "Caller", text: "It's Sam. I've been feeling hopeless for weeks." },
      { speaker: "Operator", text: "Sam, are you thinking about hurting yourself?" },
      { speaker: "Caller", text: "Sometimes I think about ending it. I have pills here." },
      { speaker: "Operator", text: "Have you taken any of those pills tonight?" },
      { speaker: "Caller", text: "No, not yet. I'm just really scared and having a panic attack." },
      { speaker: "Operator", text: "You're doing the right thing talking to me. Where are you right now?" },
      { speaker: "Caller", text: "At home, alone. My heart is racing and I can't stop shaking." },
      { speaker: "Operator", text: "Can you move the pills to another room while we keep talking?" },
    ],
  },
  {
    id: "ankle",
    label: "Fall injury",
    location: "Central Park, east entrance",
    transcript: [
      { speaker: "Operator", text: "Emergency services, what is your emergency?" },
      { speaker: "Caller", text: "Hi, I slipped while jogging and I think I twisted my ankle." },
      { speaker: "Operator", text: "Are you injured anywhere else? Did you hit your head?" },
      { speaker: "Caller", text: "No, just the ankle. It's swollen and it hurts to walk." },
      { speaker: "Operator", text: "Is there any bleeding or is the bone visible?" },
      { speaker: "Caller", text: "No bleeding, it's just swollen. I'm sitting on a bench." },
      { speaker: "Operator", text: "Is someone with you who could help you get to a clinic?" },
      { speaker: "Caller", text: "My friend is here, she can drive me." },
      { speaker: "Operator", text: "Keep the foot elevated and put something cold on it." },
    ],
  },
];

type Indicator = {
  pattern: RegExp;
  label: string;
  kind: "physical" | "mental";
  weight: number; // contribution to urgency
  ambulance?: boolean;
};

// Keyword heuristics standing in for an AI classifier.
const indicators: Indicator[] = [
  { pattern: /not breathing|stopped breathing|isn't breathing|no pulse/i, label: "Not breathing", kind: "physical", weight: 45, ambulance: true },
  { pattern: /unconscious|not responding|unresponsive|collapsed|won't wake up/i, label: "Unresponsive", kind: "physical", weight: 35, ambulance: true },
  { pattern: /can't breathe|cannot breathe|(difficulty|trouble|struggling) breathing|short of breath|choking/i, label: "Breathing difficulty", kind: "physical", weight: 35, ambulance: true },
  { pattern: /heart attack|cardiac arrest/i, label: "Suspected heart attack", kind: "physical", weight: 40, ambulance: true },
  { pattern: /stroke|face is drooping|slurred speech|slurring/i, label: "Stroke signs", kind: "physical", weight: 40, ambulance: true },
  { pattern: /overdose|took too many/i, label: "Overdose", kind: "physical", weight: 35, ambulance: true },
  { pattern: /chest pain|pain in (my|his|her) chest/i, label: "Chest pain", kind: "physical", weight: 25, ambulance: true },
  { pattern: /seizure|convuls|fitting/i, label: "Seizure", kind: "physical", weight: 30, ambulance: true },
  { pattern: /allergic|anaphyla|throat is (swelling|closing)/i, label: "Allergic reaction", kind: "physical", weight: 30, ambulance: true },
  { pattern: /(car|traffic) (crash|accident)|collision|hit by a (car|bus|truck)/i, label: "Traffic accident", kind: "physical", weight: 30, ambulance: true },
  { pattern: /lips.*blue|turning blue/i, label: "Cyanosis", kind: "physical", weight: 20, ambulance: true },
  { pattern: /(?<!no )(bleeding|blood)/i, label: "Bleeding", kind: "physical", weight: 20, ambulance: true },
  { pattern: /hit (my|his|her|their) head|head injury|concussion/i, label: "Head injury", kind: "physical", weight: 20, ambulance: true },
  { pattern: /fainted|passed out/i, label: "Fainted", kind: "physical", weight: 20, ambulance: true },
  { pattern: /pregnant|contractions|in labou?r|water broke/i, label: "Pregnancy / labour", kind: "physical", weight: 20, ambulance: true },
  { pattern: /broken|fracture/i, label: "Possible fracture", kind: "physical", weight: 12 },
  { pattern: /\bburn(ed|t|s|ing)?\b/i, label: "Burn", kind: "physical", weight: 15 },
  { pattern: /twisted|sprain|swollen/i, label: "Limb injury", kind: "physical", weight: 8 },
  { pattern: /hurts|pain(?!t)/i, label: "Pain", kind: "physical", weight: 5 },
  { pattern: /heart is racing|shaking|dizzy/i, label: "Physical stress symptoms", kind: "physical", weight: 6 },
  { pattern: /ending it|end my life|kill myself|want to die|hurting yourself|suicid/i, label: "Suicidal ideation", kind: "mental", weight: 40, ambulance: true },
  { pattern: /self[- ]harm|cut(ting)? myself|hurt(ing)? myself/i, label: "Self-harm", kind: "mental", weight: 30, ambulance: true },
  { pattern: /hearing voices|hallucinat|paranoi/i, label: "Psychosis signs", kind: "mental", weight: 20 },
  { pattern: /pills/i, label: "Means available", kind: "mental", weight: 15 },
  { pattern: /hopeless|can't do this anymore|depress/i, label: "Hopelessness", kind: "mental", weight: 15 },
  { pattern: /panic attack|scared|anxious|anxiety/i, label: "Panic / anxiety", kind: "mental", weight: 10 },
  { pattern: /alone/i, label: "Isolated", kind: "mental", weight: 5 },
];

export const emptyClassification: Classification = {
  urgency: "Low",
  urgencyScore: 0,
  ambulance: false,
  physical: 50,
  mental: 50,
  indicators: [],
};

export function urgencyFromScore(score: number): Urgency {
  if (score >= 75) return "Critical";
  if (score >= 45) return "High";
  if (score >= 20) return "Medium";
  return "Low";
}

export function classify(lines: TranscriptLine[]): Classification {
  const callerText = lines
    .filter((l) => l.speaker === "Caller")
    .map((l) => l.text)
    .join(" ");

  let score = 0;
  let physical = 0;
  let mental = 0;
  let ambulance = false;
  const found: string[] = [];

  for (const ind of indicators) {
    if (!ind.pattern.test(callerText)) continue;
    score += ind.weight;
    if (ind.kind === "physical") physical += ind.weight;
    else mental += ind.weight;
    if (ind.ambulance) ambulance = true;
    found.push(ind.label);
  }

  const total = physical + mental;
  const urgencyScore = Math.min(100, score);
  return {
    urgency: urgencyFromScore(urgencyScore),
    urgencyScore,
    ambulance,
    physical: total ? Math.round((physical / total) * 100) : 50,
    mental: total ? Math.round((mental / total) * 100) : 50,
    indicators: found,
  };
}
