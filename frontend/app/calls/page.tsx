import type { Metadata } from "next";
import CallsOverview from "../components/CallsOverview";

export const metadata: Metadata = {
  title: "Ongoing Calls",
  description: "All ongoing 112 calls with their urgency and ambulance assessment",
};

export default function CallsPage() {
  return <CallsOverview />;
}
