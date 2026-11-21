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
  // Which backend model produced each part ("claude" or offline "keyword").
  sources?: { triage: ModelSource; indicators: ModelSource };
};

export type ModelSource = "claude" | "keyword";

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

export const emptyClassification: Classification = {
  urgency: "Low",
  urgencyScore: 0,
  ambulance: false,
  physical: 50,
  mental: 50,
  indicators: [],
};

// All categorisation happens in the Rust backend (backend/src); the frontend
// only sends the transcript and displays the result.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

export async function fetchClassification(
  lines: TranscriptLine[],
  signal?: AbortSignal,
): Promise<Classification> {
  const res = await fetch(`${BACKEND_URL}/api/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
    signal,
  });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}
