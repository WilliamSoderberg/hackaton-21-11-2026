"use client";

// Shared Leaflet pieces for the crew maps. Leaflet touches `window` on import,
// so only import this from components loaded with next/dynamic and ssr: false.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useLayoutEffect, useState } from "react";
import { useMap } from "react-leaflet";
import MapTiles from "./MapTiles";
import type { UrgencyLevel } from "../lib/crew";

// Marker colours matching urgencyStyles in lib/crew.ts.
export const urgencyHex: Record<UrgencyLevel, string> = {
  A: "#dc2626",
  B: "#f97316",
  C: "#fbbf24",
  D: "#10b981",
  E: "#0ea5e9",
};

// Custom pins instead of Leaflet's default image markers (those need extra
// asset wiring under a bundler).
export function pin(color: string, glyph: string | number, { pulse = false, size = 40, ring = false } = {}) {
  const inset = Math.round(size / 10);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2 - 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      ${pulse ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.35" class="animate-ping"></span>` : ""}
      <span style="position:absolute;inset:${inset}px;display:grid;place-items:center;border-radius:9999px;background:${color};color:#fff;font:700 ${Math.round(size * 0.38)}px/1 var(--font-geist-sans),sans-serif;border:3px solid #fff;box-shadow:0 0 0 ${ring ? 3 : 0}px #0f172a,0 2px 6px rgba(15,23,42,.35)">${glyph}</span>
    </div>`,
  });
}

// OSM's own tile servers block this app (403), so this now renders Esri tiles.
export function OsmTiles() {
  return <MapTiles />;
}

// Zooms the map to fit the points whenever they change (pass a memoised array).
// No animation: a zoom still running when the page is hidden (map removed)
// would fire on a dead map and throw "reading '_leaflet_pos'".
export function FitBounds({ points, maxZoom = 15 }: { points: [number, number][]; maxZoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom, animate: false });
  }, [map, points, maxZoom]);
  return null;
}

// With cacheComponents, Next.js hides a page you navigate away from in React
// <Activity> instead of unmounting it. Hiding runs react-leaflet's cleanup
// (map.remove()) but keeps the old <div>; showing the page again re-creates
// Leaflet on that same div, which throws "Map container is being reused by
// another instance" and crashes the route. Use this as the MapContainer key:
// it changes on every hide, so the map comes back on a fresh container.
export function useMapKey() {
  const [key, setKey] = useState(0);
  useLayoutEffect(() => () => setKey((k) => k + 1), []);
  return key;
}
