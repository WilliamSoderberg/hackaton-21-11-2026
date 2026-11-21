// Urgency on the crew map comes from the trained ambulance model
// (lib/ambulanceModel.ts): the probability that the call needs an ambulance,
// banded into four levels. Bands are tuned to the synthetic calls, where most
// ambulance calls score 88-99%, a few borderline ones 60-80%, and the
// no-ambulance calls under 10%.
export type UrgencyBand = { label: string; min: number; hex: string; bg: string };

export const urgencyBands: UrgencyBand[] = [
  { label: "Critical", min: 0.9, hex: "#dc2626", bg: "bg-red-700" },
  { label: "High", min: 0.75, hex: "#f97316", bg: "bg-orange-600" },
  { label: "Medium", min: 0.4, hex: "#f59e0b", bg: "bg-amber-500" },
  { label: "Low", min: 0, hex: "#10b981", bg: "bg-emerald-600" },
];

export function urgencyBand(probability: number): UrgencyBand {
  return urgencyBands.find((b) => probability >= b.min) ?? urgencyBands[urgencyBands.length - 1];
}
