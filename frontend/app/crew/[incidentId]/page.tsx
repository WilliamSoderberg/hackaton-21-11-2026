import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CrewPreparation from "../../components/CrewPreparation";
import { crewIncidents } from "../../lib/crew";

// One prerendered briefing per incident that has an ambulance; the overview
// links here. Unknown ids 404 below (dynamicParams is not allowed with
// cacheComponents).
export function generateStaticParams() {
  return crewIncidents.map((i) => ({ incidentId: i.incident_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ incidentId: string }> }): Promise<Metadata> {
  const { incidentId } = await params;
  const incident = crewIncidents.find((i) => i.incident_id === incidentId);
  return { title: incident ? `${incident.category_name} · Crew briefing` : "Crew briefing" };
}

// params is URL data: read it inside <Suspense> so navigating here from the
// overview stays instant (see the dynamic-routes docs, "With Cache Components").
export default function CrewIncidentPage({ params }: { params: Promise<{ incidentId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-slate-50 text-lg text-slate-400">Loading briefing…</div>
      }
    >
      {params.then(({ incidentId }) => {
        if (!crewIncidents.some((i) => i.incident_id === incidentId)) notFound();
        return <CrewPreparation initialId={incidentId} />;
      })}
    </Suspense>
  );
}
