"use client";

// Leaflet touches `window` on import, so this module must only be loaded on
// the client: CrewPreparation imports it with next/dynamic and ssr: false.
import { useMemo } from "react";
import { MapContainer, Marker, Polyline, Tooltip } from "react-leaflet";
import type { CrewIncident } from "../lib/crew";
import type { CrewRoute } from "../lib/useRoute";
import { FitBounds, OsmTiles, pin } from "./mapParts";

const icons = {
  scene: pin("#dc2626", "!", { pulse: true }),
  ambulance: pin("#0f172a", "A"),
  hospital: pin("#0284c7", "H"),
};

export default function CrewMap({ incident, route }: { incident: CrewIncident; route: CrewRoute }) {
  const { scene, ambulance_position: ambulance, destination_hospital: hospital } = incident;
  const dashed = route.source === "estimate" ? "8 10" : undefined;
  const points = useMemo(() => [...route.toScene.path, ...route.toHospital.path], [route]);
  return (
    <MapContainer
      center={[scene.lat, scene.lng]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <OsmTiles />
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
      <FitBounds points={points} />
    </MapContainer>
  );
}
