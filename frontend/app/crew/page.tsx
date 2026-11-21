import type { Metadata } from "next";
import CrewDashboard from "../components/CrewDashboard";

export const metadata: Metadata = {
  title: "Ambulance Crew",
  description: "All incidents in the area on one map: what to bring, the call and the route",
};

export default function CrewPage() {
  return <CrewDashboard />;
}
