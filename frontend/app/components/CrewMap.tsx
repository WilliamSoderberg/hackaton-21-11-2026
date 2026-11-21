"use client";

// Leaflet touches `window` on import, so this module must only be loaded on
// the client: CrewPreparation imports it with next/dynamic and ssr: false.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import MapTiles from "./MapTiles";
import type { CrewIncident } from "../lib/crew";
import type { CrewRoute } from "../lib/useRoute";

// Custom pins instead of Leaflet's default image markers (those need extra
// asset wiring under a bundler).
function pin(color: string, glyph: string, pulse = false) {
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -22],
    html: `<div style="position:relative;width:40px;height:40px">
      ${pulse ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.35" class="animate-ping"></span>` : ""}
      <span style="position:absolute;inset:4px;display:grid;place-items:center;border-radius:9999px;background:${color};color:#fff;font:700 15px/1 var(--font-geist-sans),sans-serif;border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35)">${glyph}</span>
    </div>`,
  });
}

const icons = {
  scene: pin("#dc2626", "!", true),
  ambulance: pin("#0f172a", "A"),
  hospital: pin("#0284c7", "H"),
};

function FitBounds({ route }: { route: CrewRoute }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([...route.toScene.path, ...route.toHospital.path]);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, route]);
  return null;
}

export default function CrewMap({ incident, route }: { incident: CrewIncident; route: CrewRoute }) {
  const { scene, ambulance_position: ambulance, destination_hospital: hospital } = incident;
  const dashed = route.source === "estimate" ? "8 10" : undefined;
  return (
    <MapContainer
      center={[scene.lat, scene.lng]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <MapTiles />
      <Polyline positions={route.toHospital.path} pathOptions={{ color: "#0284c7", weight: 5, opacity: 0.8, dashArray: dashed }} />
      <Polyline positions={route.toScene.path} pathOptions={{ color: "#dc2626", weight: 6, opacity: 0.9, dashArray: dashed }} />
      <Marker position={[ambulance.lat, ambulance.lng]} icon={icons.ambulance}>
        <Tooltip direction="top">{incident.unit}</Tooltip>
      </Marker>
      <Marker position={[hospital.lat, hospital.lng]} icon={icons.hospital}>
        <Tooltip direction="top">{hospital.name}</Tooltip>
      </Marker>
      <Marker position={[scene.lat, scene.lng]} icon={icons.scene} zIndexOffset={1000}>
        <Tooltip direction="top" permanent>
          {incident.address}
        </Tooltip>
      </Marker>
      <FitBounds route={route} />
    </MapContainer>
  );
}
