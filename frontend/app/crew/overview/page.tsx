import type { Metadata } from "next";
import CrewOverview from "../../components/CrewOverview";

export const metadata: Metadata = {
  title: "Crew Overview",
  description: "All active 112 incidents ranked by priority, with where to go first and what to bring",
};

export default function CrewOverviewPage() {
  return <CrewOverview />;
}
