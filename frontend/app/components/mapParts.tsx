"use client";

// Shared Leaflet pieces for the crew maps. Leaflet touches `window` on import,
// so only import this from components loaded with next/dynamic and ssr: false.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import MapTiles from "./MapTiles";
import type { UrgencyLevel } from "../lib/crew";

// Marker colours matching urgencyStyles in lib/crew.ts.
export const urgencyHex: Record<UrgencyLevel, string> = {
  A: "#a63d32",
  B: "#c0733a",
  C: "#c49a2c",
  D: "#5f8f72",
  E: "#5b7fa0",
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
      ${pulse ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.18"></span>` : ""}
      <span style="position:absolute;inset:${inset}px;display:grid;place-items:center;border-radius:9999px;background:${color};color:#fff;font:700 ${Math.round(size * 0.38)}px/1 var(--font-geist-sans),sans-serif;border:3px solid #fff;box-shadow:0 0 0 ${ring ? 3 : 0}px #44403c,0 1px 3px rgba(28,25,23,.25)">${glyph}</span>
    </div>`,
  });
}

// OSM's own tile servers block this app (403), so this now renders Esri tiles.
export function OsmTiles() {
  return <MapTiles />;
}

// Zooms the map to fit the points whenever they change (pass a memoised array).
export function FitBounds({ points, maxZoom = 15 }: { points: [number, number][]; maxZoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom });
  }, [map, points, maxZoom]);
  return null;
}
