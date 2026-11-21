import type { Metadata } from "next";
import CrewPreparation from "../components/CrewPreparation";

export const metadata: Metadata = {
  title: "Ambulance Crew Preparation",
  description: "What the ambulance crew needs to prepare for a dispatched 112 call",
};

export default function CrewPage() {
  return <CrewPreparation />;
}
