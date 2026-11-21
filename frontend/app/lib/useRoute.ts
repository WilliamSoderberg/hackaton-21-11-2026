"use client";

import { useEffect, useMemo, useState } from "react";
import { type CrewIncident, type LatLng, estimateMinutes } from "./crew";

export type RouteLeg = { path: [number, number][]; minutes: number };

export type CrewRoute = {
  toScene: RouteLeg; // ambulance -> incident
  toHospital: RouteLeg; // incident -> destination hospital
  source: "road" | "estimate"; // road = OSRM, estimate = straight line
};

// Public OSRM demo server: road routing from OpenStreetMap data, no API key.
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

// OSRM times assume normal traffic; with lights and sirens the crew is faster.
const LIGHTS_FACTOR = 0.8;

function straightLeg(a: LatLng, b: LatLng, lightsAndSirens: boolean): RouteLeg {
  return {
    path: [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ],
    minutes: estimateMinutes(a, b, lightsAndSirens),
  };
}

async function roadLeg(a: LatLng, b: LatLng, lightsAndSirens: boolean, signal: AbortSignal): Promise<RouteLeg> {
  const res = await fetch(`${OSRM_URL}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, {
    signal,
  });
  if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
  const route = (await res.json()).routes?.[0];
  if (!route) throw new Error("No route");
  return {
    path: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
    minutes: (route.duration / 60) * (lightsAndSirens ? LIGHTS_FACTOR : 1),
  };
}

function estimate(incident: CrewIncident): CrewRoute {
  const lights = incident.lights_and_sirens;
  return {
    toScene: straightLeg(incident.ambulance_position, incident.scene, lights),
    toHospital: straightLeg(incident.scene, incident.destination_hospital, lights),
    source: "estimate",
  };
}

// Road route for the incident, falling back to straight lines with an
// estimated drive time while loading or when OSRM is unreachable.
export function useRoute(incident: CrewIncident): CrewRoute {
  const [road, setRoad] = useState<{ id: string; route: CrewRoute } | null>(null);
  // Memoised so the map only refits when the route actually changes.
  const fallback = useMemo(() => estimate(incident), [incident]);

  useEffect(() => {
    const controller = new AbortController();
    const lights = incident.lights_and_sirens;
    Promise.all([
      roadLeg(incident.ambulance_position, incident.scene, lights, controller.signal),
      roadLeg(incident.scene, incident.destination_hospital, lights, controller.signal),
    ])
      .then(([toScene, toHospital]) =>
        setRoad({ id: incident.incident_id, route: { toScene, toHospital, source: "road" } }),
      )
      .catch(() => {
        // Keep the straight-line estimate.
      });
    return () => controller.abort();
  }, [incident]);

  return road?.id === incident.incident_id ? road.route : fallback;
}
