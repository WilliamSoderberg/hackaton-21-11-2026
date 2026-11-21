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

// Live calls come from the participants' microphones instead of a script.
export const MICROPHONE_SOURCE_ID = "microphone";

// Which side of the call this device is on. Each device picks one; the
// responder runs the dispatcher dashboard, the caller is the person in need.
export type Role = "responder" | "caller";

export const roleSpeaker: Record<Role, Speaker> = { responder: "Operator", caller: "Caller" };
export const speakerLabel: Record<Speaker, string> = { Operator: "Responder", Caller: "Caller" };

// The single shared call that every connected device sees. Lives on the
// Next.js server (app/lib/callStore.ts) and is streamed to devices over
// /api/call/events. All categorisation happens in the Rust backend
// (backend/src), and only the caller's lines are sent to it.
export type CallState = {
  callId: number;
  status: "idle" | "active" | "ended";
  sourceId: string; // MICROPHONE_SOURCE_ID or a scenario id
  startedAt: number | null; // server clock, ms
  endedAt: number | null;
  lines: TranscriptLine[];
  // Latest backend assessment, tagged with how many caller lines it covers.
  assessment: { callerLineCount: number; value: Classification } | null;
  backendError: string | null;
  // Whose microphone is on in a live call. Only one side talks at a time, so a
  // mic in the same room never transcribes the other person's voice.
  floor: Role | null;
  participants: Record<Role, number>;
  serverNow: number; // server clock when this state was sent
};

// One row of the call log the backend keeps in SQLite (backend/src/calls.rs).
// Urgency and ambulance stay null until the first assessment arrives.
export type CallRecord = {
  id: number;
  sourceId: string;
  label: string;
  location: string;
  status: "active" | "ended";
  startedAt: number; // ms
  endedAt: number | null;
  urgency: Urgency | null;
  urgencyScore: number | null;
  ambulance: boolean | null;
  physical: number | null;
  mental: number | null;
  indicators: string[];
  transcript: TranscriptLine[];
  updatedAt: number;
};
