"use client";

// Every incident in the area on one fixed map. Hovering (or tapping) a pin
// shows a short card: what the crew may need, what was said on the call, and
// the route. Leaflet touches `window` on import, so CrewDashboard loads this
// with next/dynamic and ssr: false.
import type { LatLngTuple, Map as LeafletMap } from "leaflet";
import { type CSSProperties, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Tooltip } from "react-leaflet";
import { type CrewIncident, type Incident, allIncidents, hospitals } from "../lib/crew";
import { type CrewUrgencies, type KeywordUrgency, urgencyBand } from "../lib/modelUrgency";
import { ambulanceProbability, ruleSupplies, triggerFlag } from "../lib/triage";
import { type CrewRoute, useRoute } from "../lib/useRoute";
import { FitBounds, OsmTiles, pin, useMapKey } from "./mapParts";

const points = allIncidents.map((i): [number, number] => [i.scene.lat, i.scene.lng]);
const ambulanceIcon = pin("#0f172a", "A", { size: 28 });
const hospitalIcon = pin("#3f6185", "H", { size: 30 });

// Colour/order = Rust keyword-model urgency; pin number = ambulance model %.
export default function CrewMap({ urgencies }: { urgencies: CrewUrgencies }) {
  const ranked = useMemo(() => rankByUrgency(urgencies), [urgencies]);
  const [active, setActive] = useState<{ id: string; anchor: Anchor } | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const activate = (id: string, at: LatLngTuple) => {
    if (!map) return;
    const { x, y } = map.latLngToContainerPoint(at);
    const size = map.getSize();
    setActive({ id, anchor: { x, y, w: size.x, h: size.y } });
  };
  const current = ranked.find(({ incident }) => incident.incident_id === active?.id);
  const incident = current?.incident;
  const route = useRoute(incident && incident.dispatch !== "none" ? incident : null);
  const icons = useMemo(
    () =>
      ranked.map(({ incident: i, probability, urgency }, rank) =>
        pin(urgencyBand(urgency.urgency).hex, Math.round(probability * 100), {
          pulse: rank === 0,
          size: i.incident_id === active?.id ? 42 : 34,
          ring: i.incident_id === active?.id,
        }),
      ),
    [active?.id, ranked],
  );

  const mapKey = useMapKey();
  return (
    <div className="relative h-full w-full">
      <MapContainer
        key={mapKey}
        ref={setMap}
        center={[55.705, 13.2]}
        zoom={12}
        // Fixed view: always fitted to every pin, no zooming or panning.
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        dragging={false}
        zoomSnap={0.25}
        className="h-full w-full"
      >
        <OsmTiles />
        {hospitals.map((h) => (
          <Marker key={h.name} position={[h.lat, h.lng]} icon={hospitalIcon}>
            <Tooltip direction="top">{h.name}</Tooltip>
          </Marker>
        ))}
        {incident && incident.dispatch !== "none" && route && <ActiveRoute incident={incident} route={route} />}
        {ranked.map(({ incident: i }, rank) => (
          <Marker
            key={i.incident_id}
            position={[i.scene.lat, i.scene.lng]}
            icon={icons[rank]}
            // Most urgent (and the hovered pin) drawn on top.
            zIndexOffset={(i.incident_id === active?.id ? 2000 : 1000) - rank * 10}
            eventHandlers={{
              mouseover: () => activate(i.incident_id, [i.scene.lat, i.scene.lng]),
              mouseout: () => setActive((a) => (a?.id === i.incident_id ? null : a)),
              click: () => activate(i.incident_id, [i.scene.lat, i.scene.lng]),
            }}
          />
        ))}
        <FitBounds points={points} maxZoom={14} />
      </MapContainer>
      {current && active && (
        <FloatingCard anchor={active.anchor}>
          <IncidentCard incident={current.incident} probability={current.probability} urgency={current.urgency} route={route} />
        </FloatingCard>
      )}
    </div>
  );
}

// Most urgent first (keyword score), then the ambulance model's probability.
function rankByUrgency({ byIncident }: CrewUrgencies) {
  return allIncidents
    .map((incident) => ({
      incident,
      probability: ambulanceProbability(incident),
      urgency: byIncident[incident.incident_id] ?? { urgency: "Low" as const, urgencyScore: 0 },
    }))
    .sort((a, b) => b.urgency.urgencyScore - a.urgency.urgencyScore || b.probability - a.probability);
}

// The pin's position inside the map and the map's size, in pixels.
type Anchor = { x: number; y: number; w: number; h: number };

// Card next to the pin, kept inside the map. Beside the pin (right or left,
// whichever has room) and vertically centred on it; on narrow maps above or
// below it. Measures its own height, which depends on the incident.
const CARD_W = 288;
const GAP = 26;
const EDGE = 8;
function FloatingCard({ anchor, children }: { anchor: Anchor; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    setStyle(cardPosition(anchor, Math.min(height, anchor.h - 2 * EDGE)));
  }, [anchor, children]);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute z-[1000] overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200"
      style={{ width: CARD_W, maxHeight: anchor.h - 2 * EDGE, ...style }}
    >
      {children}
    </div>
  );
}

function cardPosition({ x, y, w, h }: Anchor, height: number): CSSProperties {
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const top = clamp(y - height / 2, EDGE, h - height - EDGE);
  if (x + GAP + CARD_W <= w - EDGE) return { left: x + GAP, top };
  if (x - GAP - CARD_W >= EDGE) return { left: x - GAP - CARD_W, top };
  const left = clamp(x - CARD_W / 2, EDGE, w - CARD_W - EDGE);
  return h - y > y ? { left, top: Math.min(y + GAP, h - height - EDGE) } : { left, top: Math.max(y - GAP - height, EDGE) };
}

// Road route (or straight-line estimate) for the hovered incident: ambulance
// to scene in red, scene to hospital in blue.
function ActiveRoute({ incident, route }: { incident: CrewIncident; route: CrewRoute }) {
  const dashed = route.source === "estimate" ? "8 10" : undefined;
  const { ambulance_position: amb } = incident;
  return (
    <>
      <Polyline positions={route.toHospital.path} pathOptions={{ color: "#3f6185", weight: 4, opacity: 0.7, dashArray: dashed }} />
      <Polyline positions={route.toScene.path} pathOptions={{ color: "#dc2626", weight: 5, opacity: 0.9, dashArray: dashed }} />
      <Marker position={[amb.lat, amb.lng]} icon={ambulanceIcon}>
        <Tooltip direction="top">
          {incident.unit}
        </Tooltip>
      </Marker>
    </>
  );
}

function IncidentCard({
  incident,
  probability,
  urgency,
  route,
}: {
  incident: Incident;
  probability: number;
  urgency: KeywordUrgency;
  route: CrewRoute | null;
}) {
  const band = urgencyBand(urgency.urgency);
  const flag = triggerFlag(incident);
  const { critical, possible } = ruleSupplies(incident);
  const needs = [...critical, ...possible].slice(0, 5);
  return (
    <div className="space-y-2.5 p-3 text-xs leading-snug text-slate-700">
      <div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold text-white ${band.bg}`}>
            {band.label} · {Math.round(probability * 100)}% ambulance
          </span>
          <span className="text-slate-400">{incident.minutes_since_call} min ago</span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">{incident.category_name}</p>
        <p className="text-slate-500">{incident.address}</p>
      </div>

      <Section title="From the call">
        {flag && (
          <p className="text-slate-900">
            <span className="font-medium">{flag.label}:</span> <span className="italic">“{flag.quote}”</span>
          </p>
        )}
        <p>{incident.key_facts.slice(0, 2).join(" · ")}</p>
      </Section>

      {needs.length > 0 && (
        <Section title="May need">
          <div className="flex flex-wrap gap-1">
            {needs.map((item) => (
              <span
                key={item}
                className={`rounded px-1.5 py-0.5 ${critical.includes(item) ? "bg-red-50 font-medium text-red-800" : "bg-slate-100"}`}
              >
                {item}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="Route">
        <RouteLine incident={incident} route={route} />
      </Section>
    </div>
  );
}

function RouteLine({ incident, route }: { incident: Incident; route: CrewRoute | null }) {
  if (incident.dispatch === "none") return <p className="text-slate-500">No ambulance · advice given</p>;
  const approx = route?.source === "road" ? "" : "≈";
  const min = (m?: number) => (m === undefined ? "…" : `${approx}${Math.max(1, Math.round(m))} min`);
  return (
    <div className="space-y-0.5">
      {incident.dispatch === "pending" && <p className="font-medium text-amber-700">Pending nurse call-back</p>}
      <p>
        <span className="font-medium text-slate-900">{incident.unit}</span> → scene {min(route?.toScene.minutes)}
        {incident.lights_and_sirens && " · lights & sirens"}
      </p>
      <p>
        → {incident.destination_hospital.name} {min(route?.toHospital.minutes)}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}
