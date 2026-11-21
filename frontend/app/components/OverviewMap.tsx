"use client";

// All incidents on one map. Client-only like CrewMap: CrewOverview loads it
// with next/dynamic and ssr: false.
import { useMemo } from "react";
import { MapContainer, Marker, Polyline, Tooltip } from "react-leaflet";
import { type Incident, hospitals } from "../lib/crew";
import { FitBounds, OsmTiles, pin, urgencyHex } from "./mapParts";

const ambulanceIcon = pin("#0f172a", "A", { size: 28 });
const hospitalIcon = pin("#0284c7", "H", { size: 36 });

export default function OverviewMap({
  ranked,
  selectedId,
  onSelect,
}: {
  ranked: Incident[]; // most critical first
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const points = useMemo(() => ranked.map((i): [number, number] => [i.scene.lat, i.scene.lng]), [ranked]);
  const icons = useMemo(
    () =>
      ranked.map((i, rank) =>
        pin(i.dispatch === "none" ? "#94a3b8" : urgencyHex[i.urgency], rank + 1, {
          pulse: rank === 0,
          size: rank === 0 ? 52 : i.incident_id === selectedId ? 42 : 34,
          ring: i.incident_id === selectedId,
        }),
      ),
    [ranked, selectedId],
  );
  const selected = ranked.find((i) => i.incident_id === selectedId);

  return (
    <MapContainer center={[55.705, 13.2]} zoom={12} scrollWheelZoom={false} className="h-full w-full">
      <OsmTiles />
      {hospitals.map((h) => (
        <Marker key={h.name} position={[h.lat, h.lng]} icon={hospitalIcon}>
          <Tooltip direction="top">{h.name}</Tooltip>
        </Marker>
      ))}
      {ranked.map(
        (i) =>
          i.dispatch !== "none" && (
            <Marker key={i.unit} position={[i.ambulance_position.lat, i.ambulance_position.lng]} icon={ambulanceIcon}>
              <Tooltip direction="top">{i.unit}</Tooltip>
            </Marker>
          ),
      )}
      {selected && selected.dispatch !== "none" && (
        <Polyline
          positions={[
            [selected.ambulance_position.lat, selected.ambulance_position.lng],
            [selected.scene.lat, selected.scene.lng],
          ]}
          pathOptions={{ color: "#0f172a", weight: 4, opacity: 0.8, dashArray: "6 8" }}
        />
      )}
      {ranked.map((i, rank) => (
        <Marker
          key={i.incident_id}
          position={[i.scene.lat, i.scene.lng]}
          icon={icons[rank]}
          // Higher priority (and the selected incident) drawn on top.
          zIndexOffset={(i.incident_id === selectedId ? 2000 : 1000) - rank * 10}
          eventHandlers={{ click: () => onSelect(i.incident_id) }}
        >
          <Tooltip direction="top" permanent={rank === 0 || i.incident_id === selectedId}>
            #{rank + 1} {i.urgency} · {i.category_name}
          </Tooltip>
        </Marker>
      ))}
      <FitBounds points={points} maxZoom={14} />
    </MapContainer>
  );
}
