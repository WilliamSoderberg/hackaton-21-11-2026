import type { Metadata } from "next";
import AmbulanceTestbench from "../components/AmbulanceTestbench";

export const metadata: Metadata = {
  title: "Ambulance Model Testbench",
  description: "Paste a responder/caller conversation and see whether the trained model says it needs an ambulance",
};

export default function TestbenchPage() {
  return <AmbulanceTestbench />;
}
