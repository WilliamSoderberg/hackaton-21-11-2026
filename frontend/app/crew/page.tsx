import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import CrewDashboard from "../components/CrewDashboard";
import { crewUrgencies } from "../lib/crewUrgency";

export const metadata: Metadata = {
  title: "Ambulance Crew",
  description: "All incidents in the area on one map: what to bring, the call and the route",
};

export default function CrewPage() {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center text-slate-400">Loading incidents…</div>}>
      <CrewWithUrgency />
    </Suspense>
  );
}

// Urgency comes from the Rust keyword model at request time.
async function CrewWithUrgency() {
  await connection();
  return <CrewDashboard urgencies={await crewUrgencies()} />;
}
